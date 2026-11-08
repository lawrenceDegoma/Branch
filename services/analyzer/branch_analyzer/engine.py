"""Works out a solution's cost by interpreting it abstractly, the way you'd analyze it by hand.

1. Every value has a type with sizes: inputs from their type hints, and everything computed from
   them (`set(s)` has at most one entry per different character; a dict counting characters is
   just as small; a list filled once per item of `nums` holds len(nums) items).
2. Every line runs a number of times: a `for` loop runs once per item of what it goes over. A
   loop's total across all passes of the loops around it can be smaller than the product, and
   is, when a reason it stops is provable:
     - every pass takes an item out of a container, so it can't run more often than items went in;
     - every pass moves a pointer that only moves one way, is never reset by the loops around it,
       and stays inside a sequence;
     - every pass halves what's left;
     - every pass of the loop around it hands it a different bucket (`buckets[i]`), so all
       passes together go through each bucket's items once;
     - an item gets past a visited check (or a counter reaching zero) only once.
3. Every operation has its known cost: `x in a_set` is O(1), `x in a_list` and `s.count(c)` scan,
   sorting is n log n, comparing two dicts compares their entries.
4. Recursion is solved from its structure: one call per tree node; halving with a calls and f(n)
   work per call (the master theorem); memoized, once per distinct argument; with a visited
   check, once per item; branching without either, exponentially.

The cost of a function is the sum, over its lines, of how many times each runs times what it
costs. Nothing is run. When no rule applies, a fallback is used and the confidence drops.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field

from .cost import ONE, ZERO, Expr, Sym, exp_of, larger, log_of, smaller, sym
from .values import (
    SCALAR,
    UNKNOWN,
    Char,
    Graph,
    Inputs,
    Linked,
    MapT,
    Num,
    Seq,
    SetT,
    Str,
    Tree,
    Type,
    Unknown,
    deep_size,
    elem,
    is_collection,
    join,
    size,
    with_length,
)

HIGH, MEDIUM, LOW = 2, 1, 0
POPS = {"pop", "popleft", "remove", "discard", "heappop"}
INSERTS = {"append", "appendleft", "add", "insert", "extend", "update", "heappush", "setdefault"}
TREE_LINKS = {"left", "right"}
LIST_LINKS = {"next"}
HASH_BUILDERS = {"set", "frozenset", "Counter", "dict", "defaultdict", "OrderedDict"}
LINEAR_OF_ARG = {"list", "set", "tuple", "frozenset", "dict", "Counter", "deque", "sum", "any", "all", "sorted", "reversed", "enumerate", "zip", "map", "filter"}  # fmt: skip
STR_LINEAR = {"count", "find", "index", "rfind", "replace", "split", "strip", "lstrip", "rstrip", "lower", "upper", "isalnum", "isalpha", "isdigit", "startswith", "endswith", "join", "encode", "title", "capitalize", "swapcase"}  # fmt: skip
SEQ_LINEAR = {"index", "count", "remove", "insert", "reverse", "copy", "extend", "clear"}
MEMO_DECORATORS = {"cache", "lru_cache"}


@dataclass
class Finding:
    line: int
    template: str
    exprs: tuple[Expr, ...]
    cost: Expr
    kind: str = "time"


@dataclass
class Summary:
    """What calling a function costs: per call, plus a part paid once however often it's called
    (recursion sharing a visited set or memo across calls)."""

    per_call: Expr
    once: Expr
    space: Expr


@dataclass
class Loop:
    node: ast.AST
    starts: Expr  # how many times the loop statement itself runs


@dataclass
class Analysis:
    """Shared state for analyzing one piece of code."""

    functions: dict[str, ast.FunctionDef]
    inputs: Inputs = field(default_factory=Inputs)
    alphabet: Sym = field(default_factory=lambda: Sym("number of different characters", "", "alphabet", ("k", "a", "c", "b"), 10**6))
    findings: list[Finding] = field(default_factory=list)
    confidence: int = HIGH
    upper: bool = False
    limits: list[str] = field(default_factory=list)
    summaries: dict[ast.FunctionDef, Summary] = field(default_factory=dict)
    active: set = field(default_factory=set)
    entry_sizes: list[Expr] = field(default_factory=list)
    largest_values: dict[str, Expr] = field(default_factory=dict)
    choices: Sym | None = None

    def lower(self, level: int, limit: str | None = None):
        self.confidence = min(self.confidence, level)
        if limit and limit not in self.limits:
            self.limits.append(limit)

    def note(self, node: ast.AST | None, template: str, *exprs: Expr, cost: Expr, kind: str = "time"):
        line = getattr(node, "lineno", 0)
        # Counts settle over a few rounds; the latest note for a line replaces earlier ones.
        self.findings = [f for f in self.findings if not (f.template == template and f.line == line)]
        self.findings.append(Finding(line, template, exprs, cost, kind))

    def fallback(self) -> Expr:
        """The size used when nothing better is known: all the inputs together."""
        total = ZERO
        for s in self.entry_sizes:
            total = total + s
        return total or ONE

    def char_count(self) -> Expr:
        return sym(self.alphabet)


def _key(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute) and isinstance(node.value, ast.Name) and node.value.id == "self":
        return f"self.{node.attr}"
    return None


def _fname(node: ast.AST) -> str | None:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _is_const(node: ast.AST | None) -> bool:
    if node is None:
        return True
    if isinstance(node, ast.Constant):
        return True
    if isinstance(node, ast.UnaryOp):
        return _is_const(node.operand)
    if isinstance(node, ast.BinOp):
        return _is_const(node.left) and _is_const(node.right)
    return isinstance(node, ast.Name) and node.id.isupper()


def _names(node: ast.AST) -> set[str]:
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}


def _src(node: ast.AST, limit: int = 48) -> str:
    try:
        text = ast.unparse(node)
    except Exception:  # pragma: no cover - unparse handles every parsed node
        return "…"
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _shallow(stmts: list[ast.stmt]):
    """Nodes in these statements, not descending into nested loops or functions."""
    stack = list(stmts)
    while stack:
        node = stack.pop()
        yield node
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.For, ast.AsyncFor, ast.While, ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
                continue
            stack.append(child)


def _all(stmts: list[ast.stmt]):
    for s in stmts:
        yield from ast.walk(s)


class Frame:
    """One function, analyzed with given parameter types."""

    def __init__(self, a: Analysis, fn: ast.FunctionDef, params: dict[str, Type], parent: Frame | None, self_env: dict[str, Type]):
        self.a = a
        self.fn = fn
        self.parent = parent
        self.self_env = self_env
        self.env: dict[str, Type] = dict(params)
        self.params = set(params)
        self.base: dict[str, Type] = {}
        self.inserts: dict[str, Expr] = {}
        self.inner: dict[str, Expr] = {}
        self.popped_from: dict[str, str] = {}
        self.counts: dict[ast.AST, Expr] = {}
        self.body_totals: dict[ast.AST, Expr] = {}
        self.global_nodes: set[ast.AST] = set()
        self.loop_targets: dict[str, ast.AST] = {}
        self.distinct: set[str] = set()  # params distinct across recursive calls (visited, tree)
        self.self_name = fn.name
        self.once_paid: set[ast.FunctionDef] = set()
        self.once = ZERO
        self.space_items: list[tuple[Expr, str, ast.AST]] = []
        self.sites: list[tuple[ast.stmt, str, str, ast.AST | None]] = []
        self.round = 0
        self.paths: set[str] = set()  # backtracking paths: as long as the recursion is deep

    # Environment ------------------------------------------------------------------------------

    def lookup(self, key: str) -> Type | None:
        if key.startswith("self."):
            return self.self_env.get(key)
        frame: Frame | None = self
        while frame is not None:
            if key in frame.env:
                return frame.env[key]
            frame = frame.parent
        return None

    def owner(self, key: str) -> Frame | None:
        frame: Frame | None = self
        while frame is not None:
            if key in frame.env:
                return frame
            frame = frame.parent
        return None

    def store(self, key: str, t: Type):
        if key.startswith("self."):
            self.self_env[key] = join(self.self_env.get(key), t)
            return
        frame = self.owner(key) or self
        frame.env[key] = join(frame.env.get(key), t) if key not in frame.params or frame is not self else t

    # Types ------------------------------------------------------------------------------------

    def type_of(self, node: ast.AST | None, overlay: dict[str, Type] | None = None) -> Type:
        if node is None:
            return SCALAR
        if overlay and isinstance(node, ast.Name) and node.id in overlay:
            return overlay[node.id]
        if isinstance(node, ast.Constant):
            if isinstance(node.value, str):
                return Str(ONE)
            return Num(ONE)
        if isinstance(node, (ast.Name, ast.Attribute)) and _key(node):
            found = self.lookup(_key(node))
            if found is not None:
                return found
            if isinstance(node, ast.Name) and node.id in ("True", "False", "None"):
                return Num(ONE)
            if isinstance(node, ast.Name):
                return UNKNOWN
        if isinstance(node, ast.Attribute):
            base = self.type_of(node.value, overlay)
            if isinstance(base, Tree) and node.attr in TREE_LINKS:
                return base
            if isinstance(base, Linked) and node.attr in LIST_LINKS:
                return base
            if isinstance(base, Graph) and node.attr == "neighbors":
                return Seq(base.edges, base)
            if isinstance(base, Tree) and node.attr == "children":
                return Seq(base.nodes, base)
            return SCALAR if node.attr in ("val", "key") else UNKNOWN
        if isinstance(node, ast.Subscript):
            base = self.type_of(node.value, overlay)
            if isinstance(node.slice, ast.Slice):
                return with_length(base, self.slice_width(node, overlay)) if is_collection(base) else base
            if isinstance(base, Str):
                return Char()
            if isinstance(base, Seq):
                if base.parts and isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, int):
                    index = node.slice.value
                    if -len(base.parts) <= index < len(base.parts):
                        return base.parts[index]
                return base.elem
            if isinstance(base, MapT):
                return base.value
            return UNKNOWN
        if isinstance(node, ast.BinOp):
            left, right = self.type_of(node.left, overlay), self.type_of(node.right, overlay)
            if isinstance(node.op, ast.Add):
                if isinstance(left, Str) or isinstance(right, Str):
                    return Str(size(left) + size(right))
                if isinstance(left, Seq) and isinstance(right, Seq):
                    return Seq(left.length + right.length, join(left.elem, right.elem))
            if isinstance(node.op, ast.Mult):
                for coll, other in ((left, right), (right, left)):
                    if isinstance(coll, (Seq, Str)) and isinstance(other, Num):
                        count = other.value if other.value is not None else self.a.fallback()
                        if isinstance(coll, Str):
                            return Str(coll.length * count)
                        return Seq(coll.length * count, coll.elem)
            if isinstance(left, Num) and isinstance(right, Num):
                if left.value is None or right.value is None:
                    return Num(None if not (_is_const(node.right) and isinstance(node.op, (ast.FloorDiv, ast.Mod, ast.RShift, ast.Div))) else left.value)
                if isinstance(node.op, ast.Mult):
                    return Num(left.value * right.value)
                if isinstance(node.op, ast.Mod):
                    return Num(right.value)
                return Num(left.value + right.value)
            return left if isinstance(left, Num) else SCALAR
        if isinstance(node, ast.UnaryOp):
            return self.type_of(node.operand, overlay) if isinstance(node.op, ast.USub) else Num(ONE)
        if isinstance(node, (ast.Compare, ast.BoolOp)):
            if isinstance(node, ast.BoolOp):
                return self.type_of(node.values[-1], overlay)
            return Num(ONE)
        if isinstance(node, ast.IfExp):
            return join(self.type_of(node.body, overlay), self.type_of(node.orelse, overlay))
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            parts = tuple(self.type_of(e, overlay) for e in node.elts)
            item: Type = UNKNOWN
            for p in parts:
                item = join(item, p)
            length = ONE
            for e in node.elts:
                if isinstance(e, ast.Starred):
                    length = length + size(self.type_of(e.value, overlay))
            if isinstance(node, ast.Set):
                return SetT(length if node.elts else ZERO, item)
            kind = "tuple" if isinstance(node, ast.Tuple) else "list"
            return Seq(length if node.elts else ZERO, item, kind, parts if isinstance(node, ast.Tuple) else None)
        if isinstance(node, ast.Dict):
            return MapT(ONE if node.keys else ZERO, join(None, self.type_of(node.keys[0], overlay)) if node.keys and node.keys[0] else UNKNOWN, self.type_of(node.values[0], overlay) if node.values else UNKNOWN)
        if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            count, inner = self.comprehension(node, overlay)
            if isinstance(node, ast.DictComp):
                key_t = self.type_of(node.key, inner)
                return MapT(self.distinct_bound(count, key_t), key_t, self.type_of(node.value, inner))
            elt_t = self.type_of(node.elt, inner)
            if isinstance(node, ast.SetComp):
                return SetT(self.distinct_bound(count, elt_t), elt_t)
            return Seq(count, elt_t, "gen" if isinstance(node, ast.GeneratorExp) else "list")
        if isinstance(node, ast.Call):
            return self.call_type(node, overlay)
        if isinstance(node, ast.JoinedStr):
            return Str(ONE)
        return UNKNOWN

    def distinct_bound(self, count: Expr, item: Type) -> Expr:
        """How many different values `count` items of this type can take."""
        if isinstance(item, Char):
            return self.a.char_count()
        return count

    def comprehension(self, node, overlay):
        """Total items a comprehension produces, and its variables' types."""
        inner = dict(overlay or {})
        count = ONE
        for gen in node.generators:
            it_t = self.type_of(gen.iter, inner)
            count = count * self.iterations(gen.iter, inner)
            for name, t in self.destructure(gen.target, self.iter_elem(gen.iter, it_t)).items():
                inner[name] = t
        return count, inner

    def iter_elem(self, it: ast.AST, t: Type) -> Type:
        return elem(t)

    def destructure(self, target: ast.AST, t: Type) -> dict[str, Type]:
        if isinstance(target, ast.Name):
            return {target.id: t}
        if isinstance(target, (ast.Tuple, ast.List)):
            out: dict[str, Type] = {}
            for i, sub in enumerate(target.elts):
                if isinstance(t, Seq) and t.parts and i < len(t.parts):
                    part = t.parts[i]
                elif isinstance(t, Seq):
                    part = t.elem
                else:
                    part = UNKNOWN
                out.update(self.destructure(sub, part))
            return out
        return {}

    def call_type(self, node: ast.Call, overlay) -> Type:
        name = _fname(node.func)
        args = node.args
        first = self.type_of(args[0], overlay) if args else UNKNOWN
        receiver = self.type_of(node.func.value, overlay) if isinstance(node.func, ast.Attribute) else None
        if name == "len":
            return Num(size(first))
        if name == "range":
            bound = self.range_count(args, overlay)
            return Seq(bound, Num(bound), "range")
        if name in ("set", "frozenset"):
            if not args:
                return SetT(ZERO, UNKNOWN)
            return SetT(self.distinct_bound(size(first), elem(first)), elem(first))
        if name == "Counter":
            if not args:
                return MapT(ZERO, UNKNOWN, Num(None))
            return MapT(self.distinct_bound(size(first), elem(first)), elem(first), Num(size(first)))
        if name == "defaultdict":
            factory = _fname(args[0]) if args else None
            value: Type = Num(None)
            if factory in ("list", "deque"):
                value = Seq(ZERO, UNKNOWN)
            elif factory == "set":
                value = SetT(ZERO, UNKNOWN)
            return MapT(ZERO, UNKNOWN, value)
        if name in ("dict", "OrderedDict"):
            return MapT(size(first) if args else ZERO, UNKNOWN, UNKNOWN)
        if name in ("list", "tuple", "sorted", "reversed"):
            if not args:
                return Seq(ZERO, UNKNOWN)
            return Seq(size(first), elem(first), "tuple" if name == "tuple" else "list")
        if name == "deque":
            return Seq(size(first) if args else ZERO, elem(first) if args else UNKNOWN, "deque")
        if name == "enumerate":
            return Seq(size(first), Seq(ONE, elem(first), "tuple", (Num(size(first)), elem(first))))
        if name == "zip":
            types = [self.type_of(a, overlay) for a in args]
            return Seq(size(first), Seq(ONE, UNKNOWN, "tuple", tuple(elem(t) for t in types)))
        if name in ("str",):
            return Str(size(first) if is_collection(first) else ONE)
        if name in ("max", "min") and len(args) == 1 and isinstance(elem(first), Num):
            return Num(self.largest(args[0], first))
        if name in ("max", "min") and len(args) >= 2:
            result: Type = UNKNOWN
            for a in args:
                result = join(result, self.type_of(a, overlay))
            return result
        if name in ("sum",):
            return Num(None)
        if name in ("abs", "int", "float", "round") and args and isinstance(first, Num):
            return first
        if name in ("ord", "chr", "abs", "int", "float", "bool", "pow", "divmod", "hash", "isqrt", "sqrt", "ceil", "floor", "log", "log2", "gcd", "bisect_left", "bisect_right", "bisect"):
            return Num(ONE) if name in ("ord", "chr", "bool", "hash") else Num(None)
        if name in ("heappop", "heappushpop", "heapreplace") and args:
            return elem(first)
        if name in ("nlargest", "nsmallest") and len(args) >= 2:
            k = self.type_of(args[0], overlay)
            return Seq(k.value if isinstance(k, Num) and k.value is not None else size(self.type_of(args[1], overlay)), elem(self.type_of(args[1], overlay)))
        if receiver is not None and isinstance(node.func, ast.Attribute):
            method = node.func.attr
            if method in ("pop", "popleft", "popitem"):
                if isinstance(receiver, MapT):
                    return receiver.value
                return elem(receiver)
            if method == "get" and isinstance(receiver, MapT):
                return join(receiver.value, self.type_of(args[1], overlay)) if len(args) > 1 else receiver.value
            if method == "setdefault" and isinstance(receiver, MapT):
                return self.type_of(args[1], overlay) if len(args) > 1 else receiver.value
            if method == "items" and isinstance(receiver, MapT):
                return Seq(receiver.length, Seq(ONE, UNKNOWN, "tuple", (receiver.key, receiver.value)))
            if method == "keys" and isinstance(receiver, MapT):
                return Seq(receiver.length, receiver.key)
            if method == "values" and isinstance(receiver, MapT):
                return Seq(receiver.length, receiver.value)
            if method == "split" and isinstance(receiver, Str):
                return Seq(receiver.length, Str(receiver.length))
            if method == "join":
                return Str(size(first))
            if method in ("lower", "upper", "strip", "replace", "lstrip", "rstrip", "title", "copy"):
                return receiver
            if method in ("index", "find", "count", "rfind"):
                return Num(size(receiver))
        fn = self.local_function(node)
        if fn is not None:
            return UNKNOWN
        return UNKNOWN

    def largest(self, arg: ast.AST, t: Type) -> Expr:
        """A size for "the largest value in nums" (binary search over answers)."""
        key = _src(arg)
        if key not in self.a.largest_values:
            self.a.largest_values[key] = sym(Sym("largest value", key, "value"))
        return self.a.largest_values[key]

    def range_count(self, args: list[ast.AST], overlay=None) -> Expr:
        if not args:
            return ONE
        relevant = args[:2] if len(args) >= 2 else args
        if all(_is_const(a) for a in relevant):
            return ONE
        total = ZERO
        for a in relevant:
            if _is_const(a):
                continue
            t = self.type_of(a, overlay)
            value = t.value if isinstance(t, Num) else None
            if value is None:
                self.a.lower(MEDIUM, "When a loop's bound isn't known from the code, the inputs' total size is assumed.")
                value = self.a.fallback()
            total = total + value
        return total or ONE

    def iterations(self, it: ast.AST, overlay=None) -> Expr:
        if _is_const(it) or (isinstance(it, (ast.List, ast.Tuple, ast.Set)) and all(_is_const(e) for e in it.elts)):
            return ONE
        if isinstance(it, ast.Constant):
            return ONE
        return size(self.type_of(it, overlay))

    # Local functions --------------------------------------------------------------------------

    def local_function(self, node: ast.Call) -> ast.FunctionDef | None:
        func = node.func
        if isinstance(func, ast.Name) and func.id in self.a.functions:
            return self.a.functions[func.id]
        if isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "self" and func.attr in self.a.functions:
            return self.a.functions[func.attr]
        return None

    # Pass 1: types ----------------------------------------------------------------------------

    def infer(self, stmts: list[ast.stmt]):
        for s in stmts:
            if isinstance(s, ast.Assign):
                t = self.type_of(s.value)
                for target in s.targets:
                    self.bind(target, t, s.value)
            elif isinstance(s, ast.AnnAssign) and s.value is not None:
                self.bind(s.target, self.type_of(s.value), s.value)
            elif isinstance(s, ast.AugAssign):
                self.augment(s)
            elif isinstance(s, (ast.For, ast.AsyncFor)):
                t = self.type_of(s.iter)
                for name, part in self.destructure(s.target, elem(t)).items():
                    self.store(name, part)
                    self.loop_targets[name] = s
                self.infer(s.body)
                self.infer(s.orelse)
            elif isinstance(s, ast.While):
                self.infer(s.body)
                self.infer(s.orelse)
            elif isinstance(s, ast.If):
                self.infer(s.body)
                self.infer(s.orelse)
            elif isinstance(s, (ast.With, ast.AsyncWith)):
                self.infer(s.body)
            elif isinstance(s, ast.Try):
                self.infer(s.body)
                for h in s.handlers:
                    self.infer(h.body)
                self.infer(s.orelse)
                self.infer(s.finalbody)
            elif isinstance(s, ast.Expr) and isinstance(s.value, ast.Call):
                self.track_insert_types(s.value)

    def bind(self, target: ast.AST, t: Type, value: ast.AST | None):
        if isinstance(target, (ast.Tuple, ast.List)):
            value_parts = value.elts if isinstance(value, (ast.Tuple, ast.List)) and len(value.elts) == len(target.elts) else None
            for i, sub in enumerate(target.elts):
                if value_parts is not None:
                    self.bind(sub, self.type_of(value_parts[i]), value_parts[i])
                else:
                    for name, part in self.destructure(sub, t.parts[i] if isinstance(t, Seq) and t.parts and i < len(t.parts) else elem(t)).items():
                        self.store(name, part)
            return
        if isinstance(target, ast.Subscript):
            container = _key(target.value)
            if container:
                current = self.lookup(container)
                key_t = self.type_of(target.slice)
                if isinstance(current, MapT):
                    self.store(container, MapT(current.length, join(current.key, key_t), join(current.value, t)))
                elif isinstance(current, Seq):
                    self.store(container, Seq(current.length, join(current.elem, t), current.kind))
            return
        key = _key(target)
        if not key:
            return
        builds = value is not None and not isinstance(value, (ast.Name, ast.Attribute, ast.Subscript))
        if is_collection(t) and key not in self.base and (key not in self.params or builds):
            self.base[key] = t
        self.store(key, t)
        if isinstance(value, ast.Call):
            popped = self.popped_container(value)
            if popped:
                self.popped_from[key] = popped

    def augment(self, s: ast.AugAssign):
        key = _key(s.target)
        if key is None:
            if isinstance(s.target, ast.Subscript):
                container = _key(s.target.value)
                current = self.lookup(container) if container else None
                if isinstance(current, MapT):
                    self.store(container, MapT(current.length, join(current.key, self.type_of(s.target.slice)), join(current.value, self.type_of(s.value))))
            return
        current = self.lookup(key)
        added = self.type_of(s.value)
        if isinstance(current, Num) and isinstance(added, Num) and current.value is not None and added.value is not None and isinstance(s.op, (ast.Add, ast.Sub)):
            return
        if isinstance(current, (Seq, Str)) or isinstance(added, (Seq, Str)):
            self.store(key, join(current, added))

    def popped_container(self, call: ast.Call) -> str | None:
        func = call.func
        if isinstance(func, ast.Attribute) and func.attr in ("pop", "popleft"):
            return _key(func.value)
        if _fname(func) == "heappop" and call.args:
            return _key(call.args[0])
        return None

    def track_insert_types(self, call: ast.Call):
        func = call.func
        name = _fname(func)
        if name == "heappush" and len(call.args) >= 2:
            target, value = call.args[0], call.args[1]
        elif isinstance(func, ast.Attribute) and func.attr in ("append", "appendleft", "add", "insert") and call.args:
            target, value = func.value, call.args[-1]
        else:
            return
        value_t = self.type_of(value)
        key = _key(target)
        if key:
            current = self.lookup(key)
            if isinstance(current, Seq):
                self.store(key, Seq(current.length, join(current.elem, value_t), current.kind))
            elif isinstance(current, SetT):
                self.store(key, SetT(current.length, join(current.elem, value_t)))
            return
        if isinstance(target, ast.Subscript):
            container = _key(target.value)
            current = self.lookup(container) if container else None
            if isinstance(current, MapT) and isinstance(current.value, (Seq, SetT)):
                inner = current.value
                inner = Seq(inner.length, join(inner.elem, value_t), inner.kind) if isinstance(inner, Seq) else SetT(inner.length, join(inner.elem, value_t))
                self.store(container, MapT(current.length, join(current.key, self.type_of(target.slice)), inner))
            elif isinstance(current, Seq) and isinstance(current.elem, (Seq, SetT)):
                inner = current.elem
                inner = Seq(inner.length, join(inner.elem, value_t), inner.kind) if isinstance(inner, Seq) else SetT(inner.length, join(inner.elem, value_t))
                self.store(container, Seq(current.length, inner, current.kind))

    # Insertion sites --------------------------------------------------------------------------

    def insertion_sites(self) -> list[tuple[ast.stmt, str, str, ast.AST | None]]:
        """(statement, container, "items" | "inner" | "keys", what's added if a whole collection)."""
        sites: list[tuple[ast.stmt, str, str, ast.AST | None]] = []

        def calls_in(stmt: ast.stmt, nodes) -> None:
            for node in nodes:
                for call in (n for n in ast.walk(node) if isinstance(n, ast.Call)):
                    site = self.site_of(call)
                    if site:
                        sites.append((stmt, *site))

        def visit(stmts: list[ast.stmt]) -> None:
            for s in stmts:
                if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                    continue
                if isinstance(s, (ast.For, ast.AsyncFor)):
                    calls_in(s, [s.iter])
                    visit(s.body)
                    visit(s.orelse)
                elif isinstance(s, (ast.While, ast.If)):
                    calls_in(s, [s.test])
                    visit(s.body)
                    visit(s.orelse)
                elif isinstance(s, (ast.With, ast.AsyncWith)):
                    visit(s.body)
                elif isinstance(s, ast.Try):
                    visit(s.body)
                    for h in s.handlers:
                        visit(h.body)
                    visit(s.orelse)
                    visit(s.finalbody)
                else:
                    calls_in(s, [s])
                    targets = s.targets if isinstance(s, ast.Assign) else [s.target] if isinstance(s, (ast.AugAssign, ast.AnnAssign)) else []
                    for target in targets:
                        if isinstance(target, ast.Subscript):
                            container = _key(target.value)
                            if container and isinstance(self.lookup(container), MapT):
                                sites.append((s, container, "keys", None))
                        elif isinstance(s, ast.AugAssign) and isinstance(s.op, ast.Add) and _key(target):
                            if isinstance(self.lookup(_key(target)), Seq):
                                sites.append((s, _key(target), "items", s.value))

        visit(self.fn.body)
        return sites

    def site_of(self, call: ast.Call) -> tuple[str, str, ast.AST | None] | None:
        func = call.func
        name = _fname(func)
        if name == "heappush" and call.args:
            key = _key(call.args[0])
            return (key, "items", None) if key else None
        if not isinstance(func, ast.Attribute) or func.attr not in INSERTS:
            return None
        extra = call.args[0] if func.attr in ("extend", "update") and call.args else None
        key = _key(func.value)
        if key:
            if func.attr == "setdefault":
                return (key, "keys", None)
            return (key, "items", extra)
        target = func.value
        if isinstance(target, ast.Subscript):
            container = _key(target.value)
            if container:
                return (container, "inner", extra)
        if isinstance(target, ast.Call) and isinstance(target.func, ast.Attribute) and target.func.attr == "setdefault":
            container = _key(target.func.value)
            if container:
                return (container, "inner", extra)
        return None

    # Pass 2: how many times each line runs ------------------------------------------------------

    def run_counts(self):
        sites = self.sites = self.insertion_sites()
        previous: dict[str, Expr] = {}
        for self.round in range(4):
            self.counts, self.body_totals, self.global_nodes = {}, {}, set()
            self.walk(self.fn.body, ONE, [], False)
            totals: dict[tuple[str, str], Expr] = {}
            for stmt, container, kind, extra in sites:
                count = self.counts.get(stmt, ZERO)
                if extra is not None:
                    count = count * size(self.type_of(extra))
                totals[(container, kind)] = totals.get((container, kind), ZERO) + count
            changed = False
            for (container, kind), total in totals.items():
                if previous.get(f"{container}:{kind}") != total:
                    changed = True
                previous[f"{container}:{kind}"] = total
                self.apply_growth(container, kind, total)
            if not changed:
                return
        # Still growing: a container filled inside a loop that empties it, with nothing to bound
        # how often an item can come back.
        self.a.lower(LOW, "A container is filled and emptied in the same loop with nothing visible limiting how often an item returns; its size is taken as the inputs' total size.")
        self.a.upper = True

    def apply_growth(self, container: str, kind: str, total: Expr):
        if container in self.paths:
            return
        owner = self if container.startswith("self.") else (self.owner(container) or self)
        base = owner.base.get(container) or self.lookup(container)
        if base is None:
            return
        if kind == "inner":
            self.inner[container] = total
            current = self.lookup(container)
            if isinstance(current, MapT):
                value = with_length(current.value, total)
                keys = current.length + total if not isinstance(current.key, Char) else self.a.char_count()
                self.store_exact(container, MapT(keys if size(base) != total else current.length, current.key, value))
            elif isinstance(current, Seq):
                self.store_exact(container, Seq(current.length, with_length(current.elem, total), current.kind))
            return
        self.inserts[container] = total
        current = self.lookup(container)
        length = size(base) + total
        if isinstance(current, (MapT, SetT)):
            key_t = current.key if isinstance(current, MapT) else current.elem
            if isinstance(key_t, Char):
                length = self.a.char_count()
        if current is not None:
            self.store_exact(container, with_length(current, length))

    def store_exact(self, key: str, t: Type):
        if key.startswith("self."):
            self.self_env[key] = t
            return
        frame = self.owner(key) or self
        frame.env[key] = t

    def consumed_total(self, container: str, loop: ast.AST) -> Expr:
        """How many items can be taken out of `container` by a loop that takes one per pass.

        Items put back in inside the loop make this circular (a BFS queue): the first round assumes
        the inputs' total size, and later rounds use what the insertions inside are limited to
        (each tree node pushed once, each item past a visited check once)."""
        inside = [site for site in self.sites if site[1] == container and any(n is site[0] for n in ast.walk(loop))]
        if inside and isinstance(loop, ast.While) and self.shrinks(loop.body, container):
            return self.initial_and_outside(container, inside)
        if inside and self.round == 0:
            return self.initial_and_outside(container, inside) + self.a.fallback()
        if inside and not all(self.is_capped(site[0]) for site in inside):
            self.a.lower(LOW, "A container is refilled inside the loop that empties it, with nothing visible limiting how often an item returns.")
            self.a.upper = True
            return self.initial_and_outside(container, inside) + self.a.fallback()
        return self.total_in(container)

    def initial_and_outside(self, container: str, inside) -> Expr:
        """Items in the container before the loop: its initial size and insertions elsewhere."""
        owner = self.owner(container) or self
        base = owner.base.get(container)
        total = size(base) if base is not None else size(self.lookup(container) or UNKNOWN)
        inside_stmts = {id(site[0]) for site in inside}
        for stmt, key, kind, extra in self.sites:
            if key == container and kind == "items" and id(stmt) not in inside_stmts:
                count = self.counts.get(stmt, ZERO)
                total = total + (count * size(self.type_of(extra)) if extra is not None else count)
        return total

    def is_capped(self, stmt: ast.stmt) -> bool:
        return self.insert_cap(stmt) is not None

    def insert_cap(self, stmt: ast.stmt) -> Expr | None:
        """How many insertions this statement can make in total, when something limits it: a tree
        node's child (each node has one parent), a node reached only by walking down a tree, or an
        item behind a visited check or a counter reaching zero."""
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            cap = self.structural_child(stmt.value)
            if cap is not None:
                return cap
            site = self.site_of(stmt.value)
            if site and stmt.value.args:
                value = stmt.value.args[-1]
                if isinstance(value, ast.Name) and self.descends_tree(value.id):
                    return size(self.lookup(value.id) or UNKNOWN)
        for node in ast.walk(self.fn):
            if isinstance(node, ast.If) and any(n is stmt for n in _all(node.body)):
                visited = self.visited_guard(node)
                if visited:
                    return self.universe(visited)
                counter = self.counter_guard_test(node)
                if counter:
                    return size(self.lookup(counter) or UNKNOWN)
        return None

    def descends_tree(self, name: str) -> bool:
        """`name` is a tree node that only ever moves down the tree (to `.left`/`.right`) or is
        taken back off a stack of such nodes: it can't reach the same node twice."""
        t = self.lookup(name)
        if not isinstance(t, Tree):
            return False
        for node in ast.walk(self.fn):
            if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == name for target in node.targets):
                value = node.value
                if isinstance(value, ast.Attribute) and value.attr in TREE_LINKS:
                    continue
                if isinstance(value, ast.Call) and self.popped_container(value):
                    continue
                if isinstance(value, ast.Name) and value.id in self.params:
                    continue
                return False
        return True

    def every_pass_inserts_capped(self, body: list[ast.stmt]) -> Expr | None:
        """A loop that, on every pass, inserts an item that can be inserted only so many times."""
        for stmt in body:
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
                cap = self.insert_cap(stmt)
                if cap is not None:
                    return cap
        return None

    def shrinks(self, body: list[ast.stmt], container: str) -> bool:
        """Every pass takes out more items than it can put back (Last Stone Weight)."""
        taken = 0
        for stmt in body:
            if isinstance(stmt, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                continue
            for node in ast.walk(stmt):
                if isinstance(node, ast.Call):
                    func = node.func
                    if (isinstance(func, ast.Attribute) and func.attr in POPS and _key(func.value) == container) or (
                        _fname(func) == "heappop" and node.args and _key(node.args[0]) == container
                    ):
                        taken += 1
        put = 0
        for node in _all(body):
            if isinstance(node, ast.Call):
                site = self.site_of(node)
                if site and site[0] == container:
                    put += 1
        nested_puts = any(
            isinstance(loop, (ast.For, ast.While)) and any(isinstance(n, ast.Call) and (self.site_of(n) or (None,))[0] == container for n in _all(loop.body))
            for loop in _all(body)
        )
        return taken > put and not nested_puts

    def total_in(self, container: str) -> Expr:
        owner = self.owner(container) or self
        base = owner.base.get(container)
        initial = size(base) if base is not None else ZERO
        if base is None and container in self.params:
            initial = size(self.lookup(container) or UNKNOWN)
        inserted = self.inserts.get(container) or (owner.inserts.get(container) if owner is not self else None) or ZERO
        return initial + inserted

    def walk(self, stmts: list[ast.stmt], M: Expr, loops: list[Loop], glob: bool):
        for i, s in enumerate(stmts):
            self.counts[s] = M
            if glob:
                self.global_nodes.add(s)
            if isinstance(s, (ast.For, ast.AsyncFor)):
                body, g = self.for_total(s, M, loops)
                self.body_totals[s] = body
                self.walk(s.body, body, [*loops, Loop(s, M)], glob or g)
                self.walk(s.orelse, M, loops, glob)
            elif isinstance(s, ast.While):
                body, g = self.while_total(s, M, loops)
                self.body_totals[s] = body
                self.walk(s.body, body, [*loops, Loop(s, M)], glob or g)
                self.walk(s.orelse, M, loops, glob)
            elif isinstance(s, ast.If):
                cap = self.guard_cap(s, stmts, i)
                if cap is not None:
                    self.walk(s.body, smaller(M, cap), loops, True)
                else:
                    self.walk(s.body, M, loops, glob)
                self.walk(s.orelse, M, loops, glob)
                early = self.early_exit_cap(s, stmts, i)
                if early is not None:
                    M, glob = smaller(M, early), True
            elif isinstance(s, (ast.With, ast.AsyncWith)):
                self.walk(s.body, M, loops, glob)
            elif isinstance(s, ast.Try):
                self.walk(s.body, M, loops, glob)
                for h in s.handlers:
                    self.walk(h.body, M, loops, glob)
                self.walk(s.orelse, M, loops, glob)
                self.walk(s.finalbody, M, loops, glob)
            elif isinstance(s, ast.Expr) and isinstance(s.value, ast.Call):
                nodes = self.structural_child(s.value)
                if nodes is not None:
                    self.counts[s] = smaller(M, nodes)
                    self.global_nodes.add(s)

    def structural_child(self, call: ast.Call) -> Expr | None:
        """Pushing a tree node's child (q.append(node.left)): each node is pushed at most once."""
        site = self.site_of(call) if isinstance(call.func, ast.Attribute) or _fname(call.func) == "heappush" else None
        if not site or not call.args:
            return None
        value = call.args[-1]
        if isinstance(value, ast.Attribute) and value.attr in TREE_LINKS | LIST_LINKS:
            t = self.type_of(value)
            if isinstance(t, (Tree, Linked)):
                return size(t)
        return None

    def for_total(self, s: ast.For, M: Expr, loops: list[Loop]) -> tuple[Expr, bool]:
        count = self.iterations(s.iter)
        per = M * count
        drained = self.drained(s)
        if drained:
            outer = loops[-1].node if loops else s
            total = self.consumed_total(drained, outer)
            self.a.note(s, f"The loop on line {s.lineno} takes an item out of `{drained}` every pass, so in total it runs at most as many times as items were put in: {{0}}.", total, cost=total)
            self.a.lower(MEDIUM, "Loops that empty a container are counted by how many items went into it.")
            return (total, True) if not per.dominates(total) or total.dominates(per) is False else (per, False)
        part = self.partition(s, loops)
        if part is not None:
            total, note = part
            self.a.note(s, note, total, cost=total)
            return smaller(per, total), True
        if not count.is_constant():
            if M.is_constant():
                self.a.note(s, f"The loop on line {s.lineno} (`for … in {_src(s.iter, 32)}`) runs {{0}} times.", count, cost=per)
            else:
                self.a.note(s, f"The loop on line {s.lineno} (`for … in {_src(s.iter, 32)}`) runs {{0}} times each time it's reached, {{1}} times in total.", count, per, cost=per)
        return per, False

    def drained(self, s: ast.For) -> str | None:
        """`for _ in range(len(q))` whose body takes an item out of q each pass."""
        it = s.iter
        if not (isinstance(it, ast.Call) and _fname(it.func) == "range" and len(it.args) == 1):
            return None
        arg = it.args[0]
        if not (isinstance(arg, ast.Call) and _fname(arg.func) == "len" and arg.args):
            return None
        container = _key(arg.args[0])
        return container if container and self.takes_every_pass(s.body, container) else None

    def takes_every_pass(self, body: list[ast.stmt], container: str) -> bool:
        """Some statement at the top of the body always takes an item out of `container`."""
        for stmt in body:
            if isinstance(stmt, (ast.If, ast.For, ast.While, ast.Try, ast.With)):
                if isinstance(stmt, (ast.For,)) and self.drained(stmt) == container:
                    return True
                continue
            for node in ast.walk(stmt):
                if isinstance(node, ast.Call):
                    func = node.func
                    if isinstance(func, ast.Attribute) and func.attr in POPS and _key(func.value) == container:
                        return True
                    if _fname(func) == "heappop" and node.args and _key(node.args[0]) == container:
                        return True
        return False

    def partition(self, s: ast.For, loops: list[Loop]) -> tuple[Expr, str] | None:
        """`for x in buckets[i]` where i is different on every pass of the loop around it."""
        it = s.iter
        if isinstance(it, ast.Attribute) and it.attr in ("neighbors", "children") and isinstance(it.value, ast.Name) and it.value.id in self.distinct:
            node_t = self.lookup(it.value.id)
            if isinstance(node_t, Graph):
                return node_t.edges, f"On line {s.lineno}, each node is handled once, so its `{it.attr}` lists together hold every edge once: {{0}}."
            if isinstance(node_t, Tree):
                return node_t.nodes, f"On line {s.lineno}, each node is handled once, so its `{it.attr}` lists together hold every node once: {{0}}."
        if not isinstance(it, ast.Subscript) or not isinstance(it.slice, ast.Name):
            return None
        container = _key(it.value)
        if not container:
            return None
        owner = self.owner(container) or self
        inner = owner.inner.get(container) if owner is not self else self.inner.get(container)
        if inner is None:
            return None
        index = it.slice.id
        note = f"On line {s.lineno}, each pass of the loop around it hands `{_src(it)}` a different list, and all of `{container}`'s lists together hold {{0}} items, so that's its total."
        if loops and isinstance(loops[-1].node, (ast.For, ast.AsyncFor)) and index in _names(loops[-1].node.target):
            return loops[-1].starts * inner, note
        source = self.popped_from.get(index)
        if source and self.is_guarded(source):
            return inner, note
        if index in self.distinct:
            return inner, note
        return None

    def is_guarded(self, container: str) -> bool:
        """Every insertion into it inside a loop is behind a visited check or a counter."""
        return container in self.guarded_containers

    @property
    def guarded_containers(self) -> set[str]:
        found = set()
        for node in ast.walk(self.fn):
            if isinstance(node, ast.If) and (self.visited_guard(node) or self.counter_guard_test(node)):
                for inner in _all(node.body):
                    if isinstance(inner, ast.Call):
                        site = self.site_of(inner)
                        if site:
                            found.add(site[0])
        return found

    def while_total(self, s: ast.While, M: Expr, loops: list[Loop]) -> tuple[Expr, bool]:
        test_names = _names(s.test)
        body_nodes = list(_shallow(s.body))
        # Halving: binary search, or dividing a number down to nothing.
        halving = self.halving(s, test_names, body_nodes)
        if halving is not None:
            per = M * log_of(halving)
            self.a.note(s, f"The loop on line {s.lineno} halves what's left each pass, so it runs about log {{0}} times each time.", halving, cost=per)
            return per, False
        # Takes an item out of a container every pass.
        for container in sorted(test_names) + [c for c in self.containers_taken(s.body)]:
            if container in self.env or self.lookup(container) is not None:
                if is_collection(self.lookup(container) or UNKNOWN) and (self.takes_every_pass(s.body, container) or any(isinstance(b, (ast.For, ast.AsyncFor)) and self.drained(b) == container for b in s.body)):
                    total = self.consumed_total(container, s)
                    self.a.note(s, f"The loop on line {s.lineno} takes an item out of `{container}` every pass, so across the whole run it can't run more times than items were put in: {{0}}.", total, cost=total)
                    return total, True
        # Every pass inserts an item that can only be inserted so many times overall.
        capped = self.every_pass_inserts_capped(s.body)
        if capped is not None:
            self.a.note(s, f"Every pass of the loop on line {s.lineno} adds an item that can be added only once overall, so in total it runs at most {{0}} times.", capped, cost=capped)
            return capped, True
        # Walking a linked list.
        walked = self.linked_walk(s, test_names)
        if walked is not None:
            per = M * walked
            self.a.note(s, f"The loop on line {s.lineno} follows `.next` links, once per node: {{0}} times each time it runs.", walked, cost=per)
            return per, False
        # Pointers that only move one way, inside a sequence.
        pointers = self.pointer_total(s, body_nodes, test_names)
        if pointers is not None:
            total, names = pointers
            shown = ", ".join(f"`{n}`" for n in sorted(names))
            self.a.note(s, f"Every pass of the loop on line {s.lineno} moves {shown}, which only move one way inside the sequence and aren't reset by the loops around it, so in total it runs at most {{0}} times.", total, cost=total)
            return total, True
        # Walking a run of consecutive values, entered only at the start of a run: runs don't
        # overlap, so all of them together step through each value of the set once.
        runs = self.run_starts(s)
        if runs is not None:
            self.a.note(s, f"The loop on line {s.lineno} only starts at the beginning of a run of consecutive values and walks to its end; runs don't overlap, so all of them together take at most {{0}} steps.", runs, cost=runs)
            return runs, True
        # A run of consecutive values in a set: bounded by the set, per run.
        member = self.membership_walk(s, test_names, body_nodes)
        if member is not None:
            per = M * member
            self.a.upper = True
            self.a.lower(MEDIUM, f"The loop on line {s.lineno} is counted at its most each time; it may run less in total.")
            self.a.note(s, f"Each time the loop on line {s.lineno} runs, it steps through different values of a set, so at most {{0}} times; the analysis can't tell whether its total across all runs is smaller.", member, cost=per)
            return per, False
        fallback = self.a.fallback()
        self.a.upper = True
        self.a.lower(LOW, f"How many times the loop on line {s.lineno} runs couldn't be worked out; the inputs' total size was assumed.")
        self.a.note(s, f"How many times the `while` loop on line {s.lineno} runs couldn't be worked out from the code; it's assumed to be at most {{0}} each time.", fallback, cost=M * fallback)
        return M * fallback, False

    def containers_taken(self, body: list[ast.stmt]) -> list[str]:
        found = []
        for node in _all(body):
            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Attribute) and func.attr in POPS and _key(func.value):
                    found.append(_key(func.value))
                if _fname(func) == "heappop" and node.args and _key(node.args[0]):
                    found.append(_key(node.args[0]))
        return found

    def halving(self, s: ast.While, test_names: set[str], body_nodes) -> Expr | None:
        def magnitude(names) -> Expr:
            total = ZERO
            for name in names:
                t = self.lookup(name)
                if isinstance(t, Num) and t.value is not None and not t.value.is_constant():
                    total = total + t.value
                elif t is not None and is_collection(t):
                    total = total + size(t)
            return total or self.a.fallback()

        for node in body_nodes:
            if isinstance(node, ast.AugAssign) and isinstance(node.op, (ast.FloorDiv, ast.RShift, ast.Div)) and _key(node.target) in test_names:
                return magnitude({_key(node.target)})
            # n &= n - 1 clears the lowest set bit: at most one pass per bit, log n.
            if isinstance(node, ast.AugAssign) and isinstance(node.op, ast.BitAnd) and _key(node.target) in test_names:
                return magnitude({_key(node.target)})
        mids = set()
        for node in body_nodes:
            if isinstance(node, ast.Assign) and any(
                isinstance(sub, ast.BinOp) and isinstance(sub.op, (ast.FloorDiv, ast.RShift)) and isinstance(sub.right, ast.Constant) and sub.right.value in (1, 2)
                for sub in ast.walk(node.value)
            ):
                mids |= {t.id for t in node.targets if isinstance(t, ast.Name)}
        if not mids:
            return None
        for node in body_nodes:
            if isinstance(node, ast.Assign) and _names(node.value) & mids:
                for target in node.targets:
                    if isinstance(target, ast.Name) and target.id in test_names:
                        return magnitude(test_names)
        return None

    def linked_walk(self, s: ast.While, test_names: set[str]) -> Expr | None:
        nexts = {
            target.id
            for stmt in s.body
            if isinstance(stmt, ast.Assign) and isinstance(stmt.value, ast.Attribute) and stmt.value.attr in LIST_LINKS
            for target in stmt.targets
            if isinstance(target, ast.Name)
        }
        for stmt in s.body:
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    names = [target] if isinstance(target, ast.Name) else list(target.elts) if isinstance(target, ast.Tuple) else []
                    values = [stmt.value] if isinstance(target, ast.Name) else list(stmt.value.elts) if isinstance(stmt.value, ast.Tuple) else []
                    for name, value in zip(names, values):
                        if isinstance(name, ast.Name) and name.id in test_names and isinstance(value, ast.Name) and value.id in nexts:
                            t = self.lookup(name.id)
                            if isinstance(t, Linked):
                                return t.length
        for stmt in s.body:
            if isinstance(stmt, ast.Assign):
                for target in stmt.targets:
                    names = [target] if isinstance(target, ast.Name) else list(target.elts) if isinstance(target, ast.Tuple) else []
                    values = [stmt.value] if isinstance(target, ast.Name) else list(stmt.value.elts) if isinstance(stmt.value, ast.Tuple) else []
                    for name, value in zip(names, values):
                        if isinstance(name, ast.Name) and name.id in test_names and isinstance(value, ast.Attribute) and value.attr in LIST_LINKS:
                            t = self.lookup(name.id)
                            if isinstance(t, Linked):
                                return t.length
                        if isinstance(name, ast.Name) and name.id in test_names and isinstance(value, ast.Attribute) and isinstance(value.value, ast.Attribute) and value.value.attr in LIST_LINKS:
                            t = self.lookup(name.id)
                            if isinstance(t, Linked):
                                return t.length
        return None

    def pointer_total(self, s: ast.While, body_nodes, test_names: set[str]) -> tuple[Expr, set[str]] | None:
        moves: dict[str, set[str]] = {}
        reassigned: set[str] = set()
        for node in body_nodes:
            if isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Name):
                if isinstance(node.op, (ast.Add, ast.Sub)) and _is_const(node.value):
                    moves.setdefault(node.target.id, set()).add(type(node.op).__name__)
            if isinstance(node, ast.Assign):
                for target in node.targets:
                    reassigned |= _names(target) if isinstance(target, (ast.Name, ast.Tuple)) else set()
        candidates = {name for name, directions in moves.items() if len(directions) == 1 and name not in reassigned}
        if not candidates or not self.moves_every_pass(s.body, candidates):
            return None
        total = ZERO
        used = set()
        for name in candidates:
            bound = self.pointer_bound(name, s, candidates)
            if bound is None:
                continue
            resets = self.resets(name)
            total = total + resets * bound
            used.add(name)
        if not used:
            return None
        return total, used

    def moves_every_pass(self, body: list[ast.stmt], candidates: set[str]) -> bool:
        for stmt in body:
            if isinstance(stmt, ast.AugAssign) and isinstance(stmt.target, ast.Name) and stmt.target.id in candidates:
                return True
            if isinstance(stmt, ast.If) and stmt.orelse and self.moves_every_pass(stmt.body, candidates) and self.moves_every_pass(stmt.orelse, candidates):
                return True
        return False

    def pointer_bound(self, name: str, s: ast.While, candidates: set[str]) -> Expr | None:
        nodes = list(ast.walk(s.test)) + list(_all(s.body))
        for node in nodes:
            if isinstance(node, ast.Subscript) and name in _names(node.slice):
                t = self.type_of(node.value)
                if is_collection(t):
                    return size(t)
        for node in nodes:
            if isinstance(node, ast.Compare) and name in _names(node):
                for side in [node.left, *node.comparators]:
                    if isinstance(side, ast.Call) and _fname(side.func) == "len" and side.args:
                        return size(self.type_of(side.args[0]))
                    if isinstance(side, ast.Name) and side.id != name:
                        t = self.lookup(side.id)
                        if isinstance(t, Num) and t.value is not None and not t.value.is_constant():
                            return t.value
        start = self.lookup(name)
        if isinstance(start, Num) and start.value is not None and not start.value.is_constant():
            return start.value
        return None

    def resets(self, name: str) -> Expr:
        """How many times the pointer is (re)set: the total runs of the lines that assign it."""
        total = ZERO
        for node in ast.walk(self.fn):
            if isinstance(node, ast.Assign) and any(name in _names(t) for t in node.targets) and node in self.counts:
                total = total + self.counts[node]
        return total or ONE

    def run_starts(self, s: ast.While) -> Expr | None:
        """`if (x - 1) not in S:` around `while (x + d) in S: d += 1`."""
        test = s.test
        if not (isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.In)):
            return None
        container = _key(test.comparators[0])
        left = test.left
        if not (container and isinstance(left, ast.BinOp) and isinstance(left.op, ast.Add) and isinstance(left.left, ast.Name)):
            return None
        start = left.left.id
        for node in ast.walk(self.fn):
            if isinstance(node, ast.If) and any(n is s for n in _all(node.body)):
                guard = node.test
                if (
                    isinstance(guard, ast.Compare)
                    and len(guard.ops) == 1
                    and isinstance(guard.ops[0], ast.NotIn)
                    and _key(guard.comparators[0]) == container
                    and isinstance(guard.left, ast.BinOp)
                    and isinstance(guard.left.op, ast.Sub)
                    and isinstance(guard.left.left, ast.Name)
                    and guard.left.left.id == start
                    and _is_const(guard.left.right)
                ):
                    return size(self.lookup(container) or UNKNOWN)
        return None

    def membership_walk(self, s: ast.While, test_names: set[str], body_nodes) -> Expr | None:
        test = s.test
        if isinstance(test, ast.Compare) and any(isinstance(op, ast.In) for op in test.ops):
            container = _key(test.comparators[-1])
            t = self.lookup(container) if container else None
            stepped = {n.target.id for n in body_nodes if isinstance(n, ast.AugAssign) and isinstance(n.target, ast.Name)}
            if isinstance(t, (SetT, MapT)) and stepped & _names(test.left):
                return size(t)
        return None

    # Guards -----------------------------------------------------------------------------------

    def visited_guard(self, s: ast.If) -> str | None:
        """`if x not in seen:` whose body adds x to `seen`: each x gets in once."""
        test = s.test
        if isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.NotIn):
            container = _key(test.comparators[0])
            if container and any(
                isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "add" and _key(n.func.value) == container
                for n in _all(s.body)
            ):
                return container
        return None

    def counter_guard_test(self, s: ast.If) -> str | None:
        test = s.test
        if isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.Eq) and isinstance(test.left, ast.Subscript):
            right = test.comparators[0]
            if isinstance(right, ast.Constant) and right.value == 0:
                return _key(test.left.value)
        return None

    def universe(self, container: str) -> Expr:
        t = self.lookup(container)
        item = elem(t) if t is not None else UNKNOWN
        if isinstance(item, Char):
            return self.a.char_count()
        if isinstance(item, Num) and item.value is not None and not item.value.is_constant():
            return item.value
        if isinstance(item, Seq) and item.parts:
            total = ONE
            for part in item.parts:
                if isinstance(part, Num) and part.value is not None and not part.value.is_constant():
                    total = total * part.value
            if not total.is_constant():
                return total
        if isinstance(item, (Tree, Graph, Linked)):
            return size(item)
        self.a.lower(MEDIUM, "Items behind a visited check are assumed to number at most the inputs' total size.")
        return self.a.fallback()

    def guard_cap(self, s: ast.If, stmts, i) -> Expr | None:
        visited = self.visited_guard(s)
        if visited:
            cap = self.universe(visited)
            self.a.note(s, f"On line {s.lineno}, each item gets past the check on `{visited}` only once, so what follows runs at most {{0}} times in total.", cap, cost=ZERO)
            return cap
        counter = self.counter_guard_test(s)
        if counter and i > 0:
            prev = stmts[i - 1]
            if isinstance(prev, ast.AugAssign) and isinstance(prev.op, ast.Sub) and isinstance(prev.target, ast.Subscript) and _key(prev.target.value) == counter:
                cap = size(self.lookup(counter) or UNKNOWN)
                self.a.note(s, f"On line {s.lineno}, each counter in `{counter}` reaches zero only once, so what follows runs at most {{0}} times in total.", cap, cost=ZERO)
                return cap
        return None

    def early_exit_cap(self, s: ast.If, stmts, i) -> Expr | None:
        """`if x in seen: continue` followed by `seen.add(x)`: the rest runs once per x."""
        test = s.test
        if not (len(s.body) == 1 and isinstance(s.body[0], (ast.Continue, ast.Return, ast.Break))):
            return None
        if isinstance(test, ast.Compare) and len(test.ops) == 1 and isinstance(test.ops[0], ast.In):
            container = _key(test.comparators[0])
            if container and any(
                isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "add" and _key(n.func.value) == container
                for n in _all(stmts[i + 1 :])
            ):
                cap = self.universe(container)
                self.a.note(s, f"After line {s.lineno}, each item gets past the check on `{container}` only once, so the rest runs at most {{0}} times in total.", cap, cost=ZERO)
                return cap
        return None

    # Pass 3: what it all costs ----------------------------------------------------------------

    def cost(self) -> tuple[Expr, Expr]:
        """(cost per run of this function, cost paid once overall)."""
        local, glob = ZERO, ZERO
        for node, count in self.counts.items():
            own = self.statement_cost(node)
            if isinstance(node, ast.While):
                own_test = self.expr_cost(node.test)
                own = own_test
                total = (self.body_totals.get(node, ZERO) + count) * own
            else:
                total = count * own
            expr = self.statement_expr(node)
            if not own.is_constant() and own and not isinstance(expr, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
                runs = count if not isinstance(node, ast.While) else self.body_totals.get(node, count)
                line = getattr(node, "lineno", 0)
                if runs.is_constant():
                    self.a.note(node, f"`{_src(expr)}` on line {line} costs O({{0}}).", own, cost=total)
                else:
                    self.a.note(node, f"`{_src(expr)}` on line {line} costs O({{0}}) each time and runs {{1}} times.", own, runs, cost=total)
            if node in self.global_nodes:
                glob = glob + total
            else:
                local = local + total
        return local + self.once, glob

    def statement_expr(self, node: ast.AST) -> ast.AST:
        for attr in ("value", "iter", "test"):
            if getattr(node, attr, None) is not None:
                return getattr(node, attr)
        return node

    def statement_cost(self, s: ast.AST) -> Expr:
        if isinstance(s, (ast.Assign, ast.AnnAssign)):
            total = self.expr_cost(s.value) if s.value is not None else ZERO
            targets = s.targets if isinstance(s, ast.Assign) else [s.target]
            for target in targets:
                if isinstance(target, ast.Subscript):
                    total = total + self.expr_cost(target.slice)
            return total or ONE
        if isinstance(s, ast.AugAssign):
            total = self.expr_cost(s.value)
            if isinstance(s.target, ast.Subscript):
                total = total + self.expr_cost(s.target.slice)
            target_t = self.type_of(s.target)
            if isinstance(target_t, Seq) and isinstance(s.op, ast.Add):
                total = total + size(self.type_of(s.value))
            return total or ONE
        if isinstance(s, (ast.Expr, ast.Return)):
            return self.expr_cost(s.value) if s.value is not None else ONE
        if isinstance(s, (ast.For, ast.AsyncFor)):
            return self.expr_cost(s.iter)
        if isinstance(s, ast.If):
            return self.expr_cost(s.test)
        return ONE

    def expr_cost(self, node: ast.AST | None, overlay=None) -> Expr:
        if node is None:
            return ZERO
        if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            return self.comprehension_cost(node, overlay)
        if isinstance(node, ast.Lambda):
            return ONE
        total = ONE
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.expr_context, ast.operator, ast.cmpop, ast.boolop, ast.unaryop)):
                continue
            total = total + self.expr_cost(child, overlay)
        return total + self.op_cost(node, overlay)

    def comprehension_cost(self, node, overlay) -> Expr:
        inner = dict(overlay or {})
        count = ONE
        total = ZERO
        for gen in node.generators:
            total = total + count * self.expr_cost(gen.iter, inner)
            it_t = self.type_of(gen.iter, inner)
            count = count * self.iterations(gen.iter, inner)
            for name, t in self.destructure(gen.target, elem(it_t)).items():
                inner[name] = t
        each = ZERO
        parts = [node.key, node.value] if isinstance(node, ast.DictComp) else [node.elt]
        for part in parts:
            each = each + self.expr_cost(part, inner)
        for gen in node.generators:
            for cond in gen.ifs:
                each = each + self.expr_cost(cond, inner)
        result = total + count * (each or ONE)
        if not count.is_constant():
            sources = " and ".join(f"`{_src(g.iter, 32)}`" for g in node.generators)
            line = getattr(node, "lineno", 0)
            if each and not each.is_constant():
                self.a.note(node, f"The comprehension on line {line} goes over {sources}: {{0}} items, doing O({{1}}) work for each, so O({{2}}).", count, each, count * each, cost=result)
            else:
                self.a.note(node, f"The comprehension on line {line} goes over {sources}: {{0}} items.", count, cost=result)
        return result

    def op_cost(self, node: ast.AST, overlay=None) -> Expr:
        if isinstance(node, ast.Call):
            return self.call_cost(node, overlay)
        if isinstance(node, ast.Compare):
            total = ZERO
            left = node.left
            for op, right in zip(node.ops, node.comparators):
                if isinstance(op, (ast.In, ast.NotIn)):
                    t = self.type_of(right, overlay)
                    if isinstance(t, (Str, Seq)) and getattr(t, "kind", "") != "range":
                        total = total + size(t)
                    elif isinstance(t, Unknown):
                        self.a.lower(MEDIUM, "Some containers' types couldn't be told; checking membership in them was counted as O(1).")
                elif isinstance(op, (ast.Eq, ast.NotEq)):
                    lt, rt = self.type_of(left, overlay), self.type_of(right, overlay)
                    if is_collection(lt) and is_collection(rt):
                        total = total + size(lt) + size(rt)
                left = right
            return total
        if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Slice):
            return self.slice_width(node, overlay)
        if isinstance(node, ast.BinOp):
            t = self.type_of(node, overlay)
            if isinstance(t, (Str, Seq)) and isinstance(node.op, (ast.Add, ast.Mult)):
                return size(t)
        return ZERO

    def slice_width(self, node: ast.Subscript, overlay=None) -> Expr:
        """Copying `s[i : i + w]` costs w; other slices cost up to the whole sequence."""
        whole = size(self.type_of(node.value, overlay))
        sl = node.slice
        if isinstance(sl, ast.Slice) and sl.lower is not None and isinstance(sl.upper, ast.BinOp) and isinstance(sl.upper.op, ast.Add):
            if ast.dump(sl.upper.left) == ast.dump(sl.lower):
                width = self.type_of(sl.upper.right, overlay)
                if isinstance(width, Num):
                    return width.value if width.value is not None else whole
        return whole

    def call_cost(self, node: ast.Call, overlay=None) -> Expr:
        name = _fname(node.func)
        args = node.args
        first = self.type_of(args[0], overlay) if args else UNKNOWN
        if isinstance(node.func, ast.Name):
            if name == "len":
                return ZERO
            if name == "sorted" and args:
                n = size(first)
                return n * log_of(n)
            if name in ("max", "min") and len(args) == 1:
                return size(first)
            if name in LINEAR_OF_ARG and args:
                if name in ("reversed", "enumerate", "zip", "map", "filter"):
                    return ZERO
                return size(first)
            if name in ("heappush", "heappop", "heapreplace", "heappushpop") and args:
                return log_of(size(first))
            if name == "heapify" and args:
                return size(first)
            if name in ("nlargest", "nsmallest") and len(args) >= 2:
                n = size(self.type_of(args[1], overlay))
                k = self.type_of(args[0], overlay)
                return n * log_of(k.value if isinstance(k, Num) and k.value is not None else n)
            if name in ("bisect_left", "bisect_right", "bisect") and args:
                return log_of(size(first))
            if name in ("insort", "insort_left", "insort_right") and args:
                return size(first)
            if name in ("str", "int") and args and is_collection(first):
                return size(first)
        if isinstance(node.func, ast.Attribute):
            method = node.func.attr
            receiver = self.type_of(node.func.value, overlay)
            if method in ("heappush", "heappop", "heapreplace", "heappushpop") and args:
                return log_of(size(first))
            if method == "heapify" and args:
                return size(first)
            if method in ("bisect_left", "bisect_right") and args:
                return log_of(size(first))
            if method == "insort" and args:
                return size(first)
            if method == "sort" and isinstance(receiver, Seq):
                n = receiver.length
                return n * log_of(n)
            if method == "join":
                return size(first)
            if isinstance(receiver, Str) and method in STR_LINEAR:
                return receiver.length
            if isinstance(receiver, Seq) and receiver.kind != "deque":
                if method in SEQ_LINEAR:
                    return receiver.length + (size(first) if method == "extend" else ZERO)
                if method == "pop" and args and not (isinstance(args[0], ast.UnaryOp) or (isinstance(args[0], ast.Constant) and args[0].value == -1)):
                    return receiver.length
            if isinstance(receiver, (SetT, MapT)) and method in ("update", "union", "intersection", "difference", "copy", "issubset", "issuperset"):
                return size(first) if method == "update" else size(receiver)
            if isinstance(receiver, Seq) and method in ("extend",):
                return size(first)
        fn = self.local_function(node)
        if fn is not None:
            return self.call_local(fn, node, overlay)
        return ZERO

    def call_local(self, fn: ast.FunctionDef, node: ast.Call, overlay) -> Expr:
        if fn.name == self.self_name or fn in self.a.active:
            return ZERO  # a recursive call: costed by the recursion as a whole
        params = [a.arg for a in fn.args.args if a.arg != "self"]
        types: dict[str, Type] = {}
        for name, arg in zip(params, node.args):
            types[name] = self.type_of(arg, overlay)
        for kw in node.keywords:
            if kw.arg in params:
                types[kw.arg] = self.type_of(kw.value, overlay)
        summary = self.a.summarize(fn, types, self, self.self_env)
        if summary.once and fn not in self.once_paid:
            self.once_paid.add(fn)
            self.once = self.once + summary.once
        if summary.space:
            self.space_items.append((summary.space, f"`{fn.name}`", node))
        return summary.per_call

    # Space ------------------------------------------------------------------------------------

    def space(self) -> Expr:
        total = ZERO
        for key, base in self.base.items():
            t = self.lookup(key)
            if t is None:
                continue
            if key in self.inner:
                # Buckets: the lists hold each item once; a dict's keys can be big themselves.
                keys = deep_size(t.key) if isinstance(t, MapT) and is_collection(t.key) else ZERO
                held = size(t) * (ONE + keys) + self.inner[key]
            else:
                held = deep_size(t)
            if held and not held.is_constant():
                self.space_items.append((held, f"`{key}`", self.fn))
                self.a.note(self.fn, f"`{key}` holds up to {{0}} items.", held, cost=held, kind="space")
                total = total + held
        for node in ast.walk(self.fn):
            if isinstance(node, ast.Call) and _fname(node.func) in ("sorted", "list", "set", "Counter", "tuple") and node.args:
                held = size(self.type_of(node))
                if not held.is_constant():
                    total = total + held
            if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Slice) and isinstance(node.ctx, ast.Load):
                held = size(self.type_of(node.value))
                if not held.is_constant():
                    total = total + held
        for held, _, _ in self.space_items:
            total = total + held
        return total


# --------------------------------------------------------------------------------------------
# Recursion
# --------------------------------------------------------------------------------------------


def _self_calls(fn: ast.FunctionDef) -> list[ast.Call]:
    calls = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Call):
            func = node.func
            if (isinstance(func, ast.Name) and func.id == fn.name) or (
                isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "self" and func.attr == fn.name
            ):
                calls.append(node)
    return calls


def _inside_loop(fn: ast.FunctionDef, call: ast.Call) -> ast.AST | None:
    for loop in ast.walk(fn):
        if isinstance(loop, (ast.For, ast.AsyncFor, ast.While)) and any(n is call for n in _all(loop.body)):
            return loop
    return None


def _analysis_summarize(self: Analysis, fn: ast.FunctionDef, types: dict[str, Type], parent: Frame | None, self_env: dict[str, Type]) -> Summary:
    if fn in self.summaries:
        return self.summaries[fn]
    if fn in self.active:
        return Summary(ZERO, ZERO, ZERO)
    self.active.add(fn)
    params: dict[str, Type] = {}
    for arg in fn.args.args:
        if arg.arg == "self":
            continue
        params[arg.arg] = types.get(arg.arg) or self.inputs.from_param(arg.arg, arg.annotation)
    frame = Frame(self, fn, params, parent, self_env)
    calls = _self_calls(fn)
    kind = _recursion_kind(frame, calls) if calls else None
    if kind in ("tree", "visited", "memo"):
        frame.distinct |= set(params)
    frame.infer(fn.body)
    frame.infer(fn.body)
    paths: set[str] = set()
    if kind is not None:
        paths = frame.paths = _path_containers(frame)
        if paths:
            depth = _recursion_depth(frame, kind, calls)
            for key in paths:
                current = frame.lookup(key)
                if current is not None and is_collection(current):
                    frame.store_exact(key, with_length(current, depth))
            frame.infer(fn.body)  # copies of the path (`path[:]`) now have its length
    frame.run_counts()
    per_call, glob = frame.cost()
    space = frame.space()
    once = ZERO
    if kind is not None:
        per_call, once, space, total_calls = _solve_recursion(self, frame, kind, calls, per_call, glob, space)
        _collect_results(frame, paths, total_calls)
    else:
        per_call = per_call + glob
    self.active.discard(fn)
    summary = Summary(per_call, once, space)
    self.summaries[fn] = summary
    return summary


Analysis.summarize = _analysis_summarize  # type: ignore[attr-defined]


def _path_containers(frame: Frame) -> set[str]:
    """Lists outside the function that each call pushes onto and pops off again (a
    backtracking path): never longer than the recursion is deep."""
    pushed, popped = set(), set()
    for node in ast.walk(frame.fn):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            key = _key(node.func.value)
            if key and key not in frame.env:
                if node.func.attr in ("append", "add"):
                    pushed.add(key)
                if node.func.attr in ("pop", "remove", "discard"):
                    popped.add(key)
    return pushed & popped


def _recursion_depth(frame: Frame, kind: str, calls) -> Expr:
    varying = _varying_params(frame, calls)
    if kind == "tree":
        t = next((frame.lookup(p.arg) for p in frame.fn.args.args if isinstance(frame.lookup(p.arg), Tree)), None)
        return t.height if isinstance(t, Tree) else frame.a.fallback()
    return _param_range(frame, varying[0]) if varying else frame.a.fallback()


def _collect_results(frame: Frame, paths: set[str], total_calls: Expr):
    """Results gathered into a list outside the function (`res.append(path.copy())`) grow
    once per call that adds them, across the whole recursion."""
    for stmt, container, kind, extra in frame.sites:
        if container in paths or container in frame.env or container.startswith("self."):
            continue
        owner = frame.owner(container)
        if owner is None or owner is frame:
            continue
        per_call = frame.counts.get(stmt, ZERO)
        if extra is not None:
            per_call = per_call * size(frame.type_of(extra))
        grown = total_calls * per_call
        owner.inserts[container] = owner.inserts.get(container, ZERO) + grown
        current = owner.env.get(container)
        if current is not None and kind == "items":
            base = owner.base.get(container)
            owner.env[container] = with_length(current, (size(base) if base is not None else ZERO) + owner.inserts[container])


def _recursion_kind(frame: Frame, calls: list[ast.Call]) -> str:
    fn = frame.fn
    decorators = {_fname(d.func if isinstance(d, ast.Call) else d) for d in fn.decorator_list}
    if decorators & MEMO_DECORATORS:
        return "memo"
    body_nodes = list(ast.walk(fn))
    stored = {_key(n.value) for n in body_nodes if isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store)}
    checked = {
        _key(c)
        for n in body_nodes
        if isinstance(n, ast.Compare) and any(isinstance(op, (ast.In, ast.NotIn)) for op in n.ops)
        for c in n.comparators
    }
    added = {
        _key(n.func.value)
        for n in body_nodes
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "add"
    }
    if (stored & checked) - {None} and not (added & checked):
        return "memo"
    grid_marked = any(
        isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store) and isinstance(n.value, ast.Subscript) for n in body_nodes
    )
    if (added & checked) - {None} or (grid_marked and len(calls) >= 2):
        return "visited"
    for call in calls:
        for arg in ast.walk(call):
            if isinstance(arg, ast.Attribute) and arg.attr in TREE_LINKS:
                return "tree"
            if isinstance(arg, ast.Attribute) and arg.attr in LIST_LINKS:
                return "list"
    loop = next((_inside_loop(fn, c) for c in calls if _inside_loop(fn, c)), None)
    if loop is not None:
        it = getattr(loop, "iter", None)
        if it is not None and isinstance(frame.type_of(it), Seq) and isinstance(elem(frame.type_of(it)), (Tree, Graph)):
            return "tree"
        return "branching"
    if any(
        isinstance(n, ast.BinOp) and isinstance(n.op, (ast.FloorDiv, ast.RShift)) for call in calls for n in ast.walk(call)
    ) or any("mid" in _names(call) for call in calls):
        return "halving"
    return "linear" if len(calls) == 1 else "branching"


def _param_range(frame: Frame, name: str) -> Expr:
    """How many values a parameter takes across the recursion."""
    fn = frame.fn
    t = frame.lookup(name)
    if isinstance(t, (Tree, Graph, Linked)):
        return size(t)
    for node in ast.walk(fn):
        if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Name) and node.slice.id == name:
            t = frame.type_of(node.value)
            if isinstance(t, (Seq, Str)):
                return size(t)
    for node in ast.walk(fn):
        if isinstance(node, ast.Compare) and name in _names(node):
            for side in [node.left, *node.comparators]:
                if isinstance(side, ast.Call) and _fname(side.func) == "len" and side.args:
                    return size(frame.type_of(side.args[0]))
                if isinstance(side, ast.Name) and side.id != name:
                    t = frame.lookup(side.id)
                    if isinstance(t, Num) and t.value is not None and not t.value.is_constant():
                        return t.value
    t = frame.lookup(name)
    if isinstance(t, Num) and t.value is not None and not t.value.is_constant():
        return t.value
    if t is not None and is_collection(t):
        return size(t)
    return frame.a.fallback()


def _varying_params(frame: Frame, calls: list[ast.Call]) -> list[str]:
    params = [a.arg for a in frame.fn.args.args if a.arg != "self"]
    varying = []
    for i, name in enumerate(params):
        for call in calls:
            if i < len(call.args) and not (isinstance(call.args[i], ast.Name) and call.args[i].id == name):
                varying.append(name)
                break
    return varying


def _solve_recursion(a: Analysis, frame: Frame, kind: str, calls, per_call: Expr, glob: Expr, space: Expr):
    fn = frame.fn
    name = fn.name
    params = [p.arg for p in fn.args.args if p.arg != "self"]
    if kind == "memo":
        states = ONE
        varying = _varying_params(frame, calls) or params[:1]
        for p in varying[:3]:
            states = states * _param_range(frame, p)
        a.lower(MEDIUM, "Memoized recursion is counted as one call per distinct argument; each argument is assumed to take the values its bounds allow.")
        a.note(fn, f"`{name}` is memoized, so it does its work once per distinct argument: about {{0}} times.", states, cost=states * per_call)
        depth = _param_range(frame, varying[0]) if varying else ONE
        a.note(fn, f"`{name}`'s memo holds up to {{0}} results.", states, cost=states, kind="space")
        return states * per_call + glob, ZERO, space * depth + states + depth, states
    if kind == "visited":
        universe = _visited_universe(frame)
        a.lower(MEDIUM, "Recursion that marks what it has visited is assumed to visit each item once.")
        a.note(fn, f"`{name}` marks what it has visited and stops at anything seen before, so it does its work at most once per item: {{0}} times overall.", universe, cost=universe * per_call)
        shared = _visited_is_shared(frame)
        total = universe * per_call + glob
        if shared:
            return ZERO, total, space + universe, universe
        return total, ZERO, space + universe, universe
    if kind == "tree":
        node_param = next((p for p in params if isinstance(frame.lookup(p), (Tree, Graph))), None)
        t = frame.lookup(node_param) if node_param else None
        nodes = size(t) if t is not None else a.fallback()
        depth = t.height if isinstance(t, Tree) else nodes
        a.note(fn, f"`{name}` calls itself on each child, so it runs once per node: {{0}} times.", nodes, cost=nodes * per_call)
        a.note(fn, f"`{name}`'s calls nest as deep as the tree is tall: {{0}}.", depth, cost=depth, kind="space")
        return nodes * per_call + glob, ZERO, space * depth + depth, nodes
    if kind == "list":
        t = next((frame.lookup(p) for p in params if isinstance(frame.lookup(p), Linked)), None)
        length = size(t) if t is not None else a.fallback()
        a.note(fn, f"`{name}` calls itself on the next node, once per node: {{0}} times.", length, cost=length * per_call)
        return length * per_call + glob, ZERO, space * length + length, length
    if kind == "halving":
        n = _halving_size(frame)
        sites = len(calls)
        degree = _degree(per_call)
        if sites == 1:
            total = log_of(n) if degree == 0 else per_call
        elif sites == 2:
            total = n if degree == 0 else (per_call * log_of(n) if degree == 1 else per_call)
        else:
            total = n * per_call
            a.lower(MEDIUM)
        a.note(fn, f"`{name}` splits its input in half {'once' if sites == 1 else f'{sites} ways'} per call, doing O({{0}}) work per call, so O({{1}}) in total (the master theorem).", per_call or ONE, total, cost=total)
        return total + glob, ZERO, space + log_of(n), n
    if kind == "linear":
        varying = _varying_params(frame, calls)
        depth = _param_range(frame, varying[0]) if varying else a.fallback()
        a.note(fn, f"`{name}` calls itself once per step, {{0}} steps deep.", depth, cost=depth * per_call)
        return depth * per_call + glob, ZERO, space * depth + depth, depth
    # Branching: calls itself more than once, or in a loop over choices, without memo or visited.
    varying = _varying_params(frame, calls)
    depth = _param_range(frame, varying[0]) if varying else a.fallback()
    loop = next((_inside_loop(fn, c) for c in calls if _inside_loop(fn, c)), None)
    if loop is not None and isinstance(loop, (ast.For, ast.AsyncFor)):
        it = loop.iter
        starts_at_param = isinstance(it, ast.Call) and _fname(it.func) == "range" and len(it.args) >= 2 and _names(it.args[0]) & set(params)
        used_check = any(isinstance(n, ast.Compare) and any(isinstance(op, (ast.In, ast.NotIn)) for op in n.ops) for n in _all(loop.body)) or any(
            isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Load) and isinstance(n.slice, ast.Name) and n.slice.id in _names(loop.target) and isinstance(frame.type_of(n.value), (Seq, MapT)) and isinstance(n.value, ast.Name) and n.value.id not in params and not is_collection(frame.type_of(n))
            for n in _all(loop.body)
        )
        choices = size(frame.type_of(it))
        if starts_at_param:
            calls_total = exp_of(depth, 2)
            how = "chooses whether to include each item, so it makes up to 2 to the power of the number of items calls"
        elif used_check and not choices.is_constant():
            calls_total = exp_of(choices, 0)
            how = "tries every unused item at each step, so it makes up to factorial-many calls"
        else:
            base: int | Sym = 2
            if not choices.is_constant():
                base = next(iter(sorted(choices.symbols(), key=lambda s: s.order)))
            elif a.choices is None:
                a.choices = Sym("number of choices at each step", "", "choices", ("c", "b"))
                base = a.choices
            else:
                base = a.choices
            calls_total = exp_of(depth, base)
            how = "tries each choice at every step"
    else:
        sites = len(calls)
        calls_total = exp_of(depth, sites if sites > 1 else 2)
        how = f"calls itself {sites} times per call without remembering results"
    a.upper = True
    a.lower(LOW, "Branching recursion is bounded by its number of calls in the worst case; pruning can make it much faster.")
    a.note(fn, f"`{name}` {how}: at most {{0}} calls.", calls_total, cost=calls_total * per_call)
    return calls_total * per_call + glob, ZERO, space + depth, calls_total


def _degree(e: Expr) -> int:
    return max((sum(p for _, p in t.powers) for t in e.terms), default=0)


def _halving_size(frame: Frame) -> Expr:
    halved = set()
    for call in _self_calls(frame.fn):
        for arg in call.args:
            for n in ast.walk(arg):
                if isinstance(n, ast.BinOp) and isinstance(n.op, (ast.FloorDiv, ast.RShift)):
                    halved |= _names(n)
            if isinstance(arg, ast.Subscript) and isinstance(arg.slice, ast.Slice) and isinstance(arg.value, ast.Name):
                halved.add(arg.value.id)
    total = ZERO
    for name in halved:
        t = frame.lookup(name)
        if t is not None and is_collection(t):
            total = total + size(t)
        elif isinstance(t, Num) and t.value is not None and not t.value.is_constant():
            total = total + t.value
    if total:
        return total
    for p in frame.fn.args.args:
        t = frame.lookup(p.arg)
        if t is not None and is_collection(t):
            total = total + size(t)
        elif isinstance(t, Num) and t.value is not None and not t.value.is_constant():
            total = total + t.value
    return total or frame.a.fallback()


def _visited_universe(frame: Frame) -> Expr:
    fn = frame.fn
    for node in ast.walk(fn):
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Subscript):
            grid = frame.type_of(node.value.value)
            if isinstance(grid, Seq) and isinstance(grid.elem, Seq):
                return grid.length * grid.elem.length
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "add":
            container = _key(node.func.value)
            if container:
                return frame.universe(container)
    return frame.a.fallback()


def _visited_is_shared(frame: Frame) -> bool:
    """The visited set (or marked grid) lives outside the function, so all calls share it."""
    fn = frame.fn
    own = {a.arg for a in fn.args.args}
    for node in ast.walk(fn):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "add":
            key = _key(node.func.value)
            if key and key not in frame.env:
                return True
        if isinstance(node, ast.Subscript) and isinstance(node.ctx, ast.Store) and isinstance(node.value, ast.Subscript):
            key = _key(node.value.value)
            if key and (key not in own or key.startswith("self.")):
                return True
            if key in own:
                return True
    return False


def analyze_tree(tree: ast.Module):
    """The entry point: returns (analysis, time, space, design) for the code's main function."""
    functions: dict[str, ast.FunctionDef] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            functions.setdefault(node.name, node)
    a = Analysis(functions)
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef)]
    solution = next((c for c in classes if c.name == "Solution"), None)
    if solution is not None:
        public = [n for n in solution.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("_")]
        if not public:
            return None
        entry = public[0]
        params = {arg.arg: a.inputs.from_param(arg.arg, arg.annotation) for arg in entry.args.args if arg.arg != "self"}
        a.entry_sizes = [size(t) for t in params.values() if not size(t).is_constant()]
        summary = a.summarize(entry, params, None, {})
        return a, summary.per_call + summary.once, summary.space, None
    if classes:
        return _design(a, classes[0])
    top = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    if not top:
        return None
    entry = top[0]
    params = {arg.arg: a.inputs.from_param(arg.arg, arg.annotation) for arg in entry.args.args}
    a.entry_sizes = [size(t) for t in params.values() if not size(t).is_constant()]
    summary = a.summarize(entry, params, None, {})
    return a, summary.per_call + summary.once, summary.space, None


def _design(a: Analysis, cls: ast.ClassDef):
    """A class with several operations (Min Stack, LRU Cache): each operation's own cost."""
    methods = [n for n in cls.body if isinstance(n, ast.FunctionDef)]
    init = next((m for m in methods if m.name == "__init__"), None)
    self_env: dict[str, Type] = {}
    stored = Sym("number of items stored", "", "items")
    if init is not None:
        params = {arg.arg: a.inputs.from_param(arg.arg, arg.annotation) for arg in init.args.args if arg.arg != "self"}
        frame = Frame(a, init, params, None, self_env)
        frame.infer(init.body)
    grown = set()
    for m in methods:
        for node in ast.walk(m):
            if isinstance(node, ast.Call):
                func = node.func
                if isinstance(func, ast.Attribute) and func.attr in INSERTS:
                    key = _key(func.value) or (_key(func.value.value) if isinstance(func.value, ast.Subscript) else None)
                    if key and key.startswith("self."):
                        grown.add(key)
                if _fname(func) == "heappush" and node.args and _key(node.args[0]):
                    grown.add(_key(node.args[0]))
            if isinstance(node, ast.Subscript) and isinstance(node.ctx, ast.Store) and _key(node.value) and _key(node.value).startswith("self."):
                grown.add(_key(node.value))
    for key in grown:
        t = self_env.get(key)
        if t is not None and is_collection(t):
            self_env[key] = with_length(t, sym(stored))
    a.entry_sizes = [sym(stored)]
    worst, space = ZERO, ZERO
    per_operation = []
    for m in methods:
        if m.name.startswith("__"):
            continue
        params = {arg.arg: a.inputs.from_param(arg.arg, arg.annotation) for arg in m.args.args if arg.arg != "self"}
        summary = a.summarize(m, params, None, self_env)
        cost = summary.per_call + summary.once
        per_operation.append((m.name, cost))
        worst = worst + cost
        space = space + summary.space
    for key in grown:
        t = self_env.get(key)
        if t is not None:
            space = space + deep_size(t)
    return a, worst, space, per_operation
