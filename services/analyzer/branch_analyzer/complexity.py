"""Estimates a Python solution's time and space complexity by reading its syntax tree.

It never runs the code. The rules are deliberately simple, so every estimate comes with the
reasons that produced it, a confidence level, and the limits of the method. Patterns the rules
can't see through (amortized pointers, recursion, library calls) lower the confidence rather
than guess with false certainty.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import Literal

Confidence = Literal["low", "medium", "high"]
_RANK = {"low": 0, "medium": 1, "high": 2}

# ----------------------------------------------------------------------------------------------
# Costs: n^power · log^log n, or exponential. Ordered by growth, so max() is the dominant term.
# ----------------------------------------------------------------------------------------------


@dataclass(frozen=True, order=True)
class Cost:
    exp: int = 0
    power: int = 0
    log: int = 0

    def __mul__(self, other: Cost) -> Cost:
        if self.exp or other.exp:
            return EXP
        return Cost(0, min(self.power + other.power, 4), min(self.log + other.log, 2))

    def describe(self) -> str:
        if self.exp:
            return "O(2ⁿ)"
        parts = []
        if self.power == 1:
            parts.append("n")
        elif self.power > 1:
            parts.append("n" + {2: "²", 3: "³", 4: "⁴"}[self.power])
        if self.log:
            parts.append("log n" if self.log == 1 else "log² n")
        return f"O({' '.join(parts) or '1'})"


ONE = Cost()
LOG = Cost(log=1)
N = Cost(power=1)
N_LOG_N = Cost(power=1, log=1)
N2 = Cost(power=2)
EXP = Cost(exp=1)

ALWAYS_LIMITS = [
    "Estimated by reading the code, without running it.",
    "n stands for the size of the input. When there are several inputs, or items with their own "
    "lengths (like each word in a list), they're all counted as n.",
]


@dataclass
class Estimate:
    status: Literal["ok", "unparseable"]
    time: str | None = None
    space: str | None = None
    confidence: Confidence | None = None
    reasons: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    message: str | None = None


# ----------------------------------------------------------------------------------------------
# Recognizing names and calls
# ----------------------------------------------------------------------------------------------

HASH_BUILDERS = {"set", "dict", "Counter", "defaultdict", "OrderedDict", "frozenset"}
SEQUENCE_BUILDERS = {"list", "deque", "tuple", "str"}
LINEAR_BUILTINS = {"list", "set", "dict", "tuple", "Counter", "sum", "max", "min", "any", "all"}
LINEAR_METHODS = {
    "index", "count", "remove", "insert", "copy", "split", "replace", "find", "reverse",
    "extend", "join", "lower", "upper", "strip", "values", "keys", "items",
}  # fmt: skip
LAZY_METHODS = {"values", "keys", "items"}
HEAP_LOG = {"heappush", "heappop", "heapreplace", "heappushpop"}
MEMO_DECORATORS = {"cache", "lru_cache"}
TREE_LINKS = {"left", "right", "next", "children", "neighbors"}


def _name(node: ast.AST) -> str | None:
    """The plain name of a call's function: `sorted`, `heapq.heappush` → `heappush`, `x.sort`."""
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return None


def _is_constant(node: ast.AST | None) -> bool:
    """A size that doesn't grow with the input: literals, UPPER_CASE names, and arithmetic of them."""
    if node is None:
        return True
    if isinstance(node, ast.Constant):
        return True
    if isinstance(node, ast.Name):
        return node.id.isupper()
    if isinstance(node, ast.UnaryOp):
        return _is_constant(node.operand)
    if isinstance(node, ast.BinOp):
        return _is_constant(node.left) and _is_constant(node.right)
    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        return all(isinstance(e, ast.Constant) for e in node.elts)
    return False


def _target_names(node: ast.AST) -> set[str]:
    return {n.id for n in ast.walk(node) if isinstance(n, ast.Name)}


def _drained_queue(loop: ast.For | ast.AsyncFor) -> str | None:
    """`q` when a loop is `for _ in range(len(q))` and its body pops from q."""
    it = loop.iter
    if not (
        isinstance(it, ast.Call)
        and _name(it.func) == "range"
        and len(it.args) == 1
        and isinstance(it.args[0], ast.Call)
        and _name(it.args[0].func) == "len"
        and it.args[0].args
    ):
        return None
    queue = _name(it.args[0].args[0])
    for statement in loop.body:
        for n in ast.walk(statement):
            if (
                isinstance(n, ast.Call)
                and isinstance(n.func, ast.Attribute)
                and n.func.attr in {"pop", "popleft", "heappop"}
                and _name(n.func.value) == queue
            ):
                return queue
    return None


def _assigned_names(loop: ast.For | ast.AsyncFor) -> set[str]:
    """Names a loop sets on every pass: its own target, and plain assignments in its body."""
    names = _target_names(loop.target)
    for statement in loop.body:
        if isinstance(statement, ast.Assign):
            for target in statement.targets:
                names |= _target_names(target)
    return names


# ----------------------------------------------------------------------------------------------
# The analysis
# ----------------------------------------------------------------------------------------------


@dataclass
class _Finding:
    text: str
    cost: Cost


@dataclass
class _Recursion:
    kind: Literal["memo", "visited", "tree", "linear", "halving", "branching"]
    params: int


class _Analyzer:
    def __init__(self, functions: dict[str, ast.FunctionDef], params: set[str]):
        self.functions = functions
        self.params = params
        self.hash_names: set[str] = set()
        self.sequence_names: set[str] = set()
        self.findings: list[_Finding] = []
        self.confidence: Confidence = "high"
        self.limits: list[str] = []
        self.space = ONE
        self.space_reasons: list[str] = []
        self.loop_depth = 0
        # For each enclosing loop: names (re)assigned on every pass, so not carried across passes.
        self.reset_names: list[set[str]] = []
        self._function_costs: dict[str, Cost] = {}
        self._active: set[str] = set()

    # Bookkeeping ------------------------------------------------------------------------------

    def note(self, text: str, cost: Cost, confidence: Confidence = "high", limit: str | None = None):
        if all(f.text != text for f in self.findings):
            self.findings.append(_Finding(text, cost))
        if _RANK[confidence] < _RANK[self.confidence]:
            self.confidence = confidence
        if limit and limit not in self.limits:
            self.limits.append(limit)

    def grow_space(self, cost: Cost, reason: str):
        if cost > self.space:
            self.space = cost
        if cost > ONE and reason not in self.space_reasons:
            self.space_reasons.append(reason)

    # Statements -------------------------------------------------------------------------------

    def block(self, statements: list[ast.stmt]) -> Cost:
        total = ONE
        for statement in statements:
            total = max(total, self.statement(statement))
        return total

    def statement(self, node: ast.stmt) -> Cost:
        if isinstance(node, (ast.For, ast.AsyncFor)):
            return self.for_loop(node)
        if isinstance(node, ast.While):
            return self.while_loop(node)
        if isinstance(node, ast.If):
            return max(self.expr(node.test), self.block(node.body), self.block(node.orelse))
        if isinstance(node, (ast.With, ast.AsyncWith)):
            return self.block(node.body)
        if isinstance(node, ast.Try):
            handlers = [self.block(h.body) for h in node.handlers]
            return max([self.block(node.body), self.block(node.finalbody), *handlers])
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            return ONE  # costed where it's called
        if isinstance(node, ast.Assign):
            for target in node.targets:
                self.remember_kind(target, node.value)
            self.track_growth(node)
            return self.expr(node.value)
        if isinstance(node, ast.AnnAssign) and node.value is not None:
            self.remember_kind(node.target, node.value)
            return self.expr(node.value)
        if isinstance(node, ast.AugAssign):
            self.track_growth(node)
            return self.expr(node.value)
        if isinstance(node, (ast.Expr, ast.Return)) and node.value is not None:
            if isinstance(node, ast.Expr):
                self.track_growth(node)
            return self.expr(node.value)
        return ONE

    def iterations(self, iterable: ast.expr) -> Cost:
        if isinstance(iterable, ast.Call) and _name(iterable.func) == "range":
            return ONE if all(_is_constant(a) for a in iterable.args) else N
        if _is_constant(iterable):
            return ONE
        if isinstance(iterable, ast.Constant):
            return ONE
        return N

    def for_loop(self, node: ast.For | ast.AsyncFor) -> Cost:
        count = self.iterations(node.iter)
        drained = _drained_queue(node)
        if drained and self.loop_depth > 0:
            # `for _ in range(len(q))` that pops q, inside `while q`: each item is popped once
            # in total, however the passes split them (level-by-level breadth-first search).
            count = ONE
            self.note(
                f"An inner loop pops `{drained}` until the current batch is gone, so across the "
                "outer loop each item is handled once.",
                N,
                "medium",
                "Amortized loops (sliding windows, monotonic stacks) are recognized by their shape; "
                "an unusual one may be counted wrong.",
            )
        self.loop_depth += 1
        self.reset_names.append(_assigned_names(node))
        body = self.block(node.body)
        self.reset_names.pop()
        self.loop_depth -= 1
        total = count * body
        if count > ONE and body > ONE:
            self.note(
                f"A loop over the input contains work costing {body.describe()} per pass.", total
            )
        elif count > ONE:
            self.note("A loop goes over the input once.", total)
        return max(self.expr(node.iter), total, self.block(node.orelse))

    def while_loop(self, node: ast.While) -> Cost:
        test_names = _target_names(node.test)
        body_nodes = [n for s in node.body for n in ast.walk(s)]
        halves = any(
            isinstance(n, ast.AugAssign)
            and isinstance(n.op, (ast.FloorDiv, ast.RShift, ast.Div))
            and isinstance(n.target, ast.Name)
            and n.target.id in test_names
            for n in body_nodes
        ) or any(
            isinstance(n, ast.BinOp)
            and isinstance(n.op, (ast.FloorDiv, ast.RShift))
            and isinstance(n.right, ast.Constant)
            and n.right.value in (1, 2)
            and _target_names(n) & test_names
            for n in body_nodes
        )
        pops_from_test = any(
            isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr in {"pop", "popleft", "heappop", "remove", "discard"}
            and _target_names(n.func.value) & test_names
            for n in body_nodes
        )
        # A pointer moved by the inner loop that the outer loop never resets keeps its progress.
        reset = self.reset_names[-1] if self.reset_names else set()
        moved = {
            n.target.id
            for n in body_nodes
            if isinstance(n, ast.AugAssign)
            and isinstance(n.target, ast.Name)
            and isinstance(n.op, (ast.Add, ast.Sub))
            and n.target.id not in reset
        }

        self.loop_depth += 1
        body = self.block(node.body)
        self.loop_depth -= 1

        if halves:
            count = LOG
            self.note("A loop halves its range each time (binary search), so it runs log n times.", LOG * body)
        elif self.loop_depth > 0 and (pops_from_test or moved):
            # Inside another loop: a pointer that only moves forward, or a stack that's popped,
            # runs at most n times in total across all the outer passes.
            count = ONE
            self.note(
                "An inner loop moves a pointer that never resets (or pops a stack each item was "
                "pushed onto once), so across the whole outer loop it runs at most n times.",
                N * body,
                "medium",
                "Amortized loops (sliding windows, monotonic stacks) are recognized by their shape; "
                "an unusual one may be counted wrong.",
            )
        else:
            count = N
            self.note(
                "A while loop is assumed to run about n times.",
                N * body,
                "medium",
                "How many times a while loop runs is guessed from its shape, not proven.",
            )
        return max(self.expr(node.test), count * body)

    # Data structures --------------------------------------------------------------------------

    def remember_kind(self, target: ast.expr, value: ast.expr):
        if not isinstance(target, ast.Name):
            return
        kind = self.kind_of(value)
        name = target.id
        if kind == "hash":
            self.hash_names.add(name)
            self.sequence_names.discard(name)
        elif kind == "sequence":
            self.sequence_names.add(name)
            self.hash_names.discard(name)
        size = self.size_of(value)
        if size > ONE:
            self.grow_space(size, f"`{name}` holds up to {size.describe()[2:-1]} items.")

    def kind_of(self, value: ast.expr) -> str | None:
        if isinstance(value, (ast.Set, ast.Dict, ast.SetComp, ast.DictComp)):
            return "hash"
        if isinstance(value, (ast.List, ast.ListComp, ast.Tuple)):
            return "sequence"
        if isinstance(value, ast.BinOp) and isinstance(value.left, ast.List):
            return "sequence"
        if isinstance(value, ast.Call):
            name = _name(value.func)
            if name in HASH_BUILDERS:
                return "hash"
            if name in SEQUENCE_BUILDERS or name == "sorted":
                return "sequence"
        return None

    def size_of(self, value: ast.expr) -> Cost:
        """How many items a newly built container holds."""
        if isinstance(value, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            size = ONE
            for generator in value.generators:
                size = size * self.iterations(generator.iter)
            inner = value.elt if not isinstance(value, ast.DictComp) else value.value
            return size * self.size_of(inner)
        if isinstance(value, ast.BinOp) and isinstance(value.op, ast.Mult):
            for side, other in ((value.left, value.right), (value.right, value.left)):
                if isinstance(side, (ast.List, ast.Constant)):
                    inner = ONE
                    if isinstance(side, ast.List) and side.elts:
                        inner = self.size_of(side.elts[0])
                    return (ONE if _is_constant(other) else N) * inner
        if isinstance(value, ast.Call):
            name = _name(value.func)
            if name in HASH_BUILDERS | SEQUENCE_BUILDERS | {"sorted"} and value.args:
                return ONE if _is_constant(value.args[0]) else N
        return ONE

    def track_growth(self, node: ast.stmt):
        """A container filled inside a loop over the input holds up to n items."""
        if self.loop_depth == 0:
            return
        grown: str | None = None
        for n in ast.walk(node):
            if (
                isinstance(n, ast.Call)
                and isinstance(n.func, ast.Attribute)
                and n.func.attr in {"append", "add", "appendleft", "heappush", "extend"}
            ):
                grown = _name(n.func.value) or (
                    _name(n.args[0]) if n.func.attr == "heappush" and n.args else None
                )
            elif (
                isinstance(n, ast.Subscript)
                and isinstance(n.ctx, ast.Store)
                and _name(n.value) in self.hash_names
            ):
                grown = _name(n.value)  # a new key; writing into a list doesn't grow it
        if grown and grown != "self" and grown not in self.params:
            self.grow_space(N, f"`{grown}` grows inside a loop, up to n items.")

    # Expressions ------------------------------------------------------------------------------

    def expr(self, node: ast.expr | None) -> Cost:
        if node is None:
            return ONE
        total = ONE
        for n in self._walk_shallow(node):
            total = max(total, self.node_cost(n))
        return total

    def _walk_shallow(self, node: ast.AST):
        """Every node in an expression, but comprehensions are costed as a whole."""
        yield node
        if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp, ast.Lambda)):
            return
        for child in ast.iter_child_nodes(node):
            yield from self._walk_shallow(child)

    def node_cost(self, node: ast.AST) -> Cost:
        if isinstance(node, (ast.ListComp, ast.SetComp, ast.DictComp, ast.GeneratorExp)):
            count = ONE
            for generator in node.generators:
                count = count * self.iterations(generator.iter)
            elt = node.value if isinstance(node, ast.DictComp) else node.elt
            conditions = [self.expr(c) for g in node.generators for c in g.ifs]
            total = count * max([self.expr(elt), *conditions])
            if count > ONE:
                self.note("A comprehension goes over the input.", total)
            return total
        if isinstance(node, ast.Call):
            return self.call_cost(node)
        if isinstance(node, ast.Compare):
            return self.membership_cost(node)
        if isinstance(node, ast.Subscript) and isinstance(node.slice, ast.Slice):
            bounds = (node.slice.lower, node.slice.upper, node.slice.step)
            if not all(_is_constant(b) for b in bounds) or node.slice.step is not None:
                self.note("Slicing copies part of a sequence, costing O(n).", N)
                return N
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mult):
            if isinstance(node.left, ast.List) and not _is_constant(node.right):
                return N
        return ONE

    def membership_cost(self, node: ast.Compare) -> Cost:
        if not any(isinstance(op, (ast.In, ast.NotIn)) for op in node.ops):
            return ONE
        container = node.comparators[-1]
        name = _name(container)
        if isinstance(container, (ast.Set, ast.Dict)) or name in self.hash_names:
            return ONE
        if isinstance(container, ast.Call) and _name(container.func) in {"keys"}:
            return ONE
        if _is_constant(container):
            return ONE
        if name in self.sequence_names or name in self.params:
            self.note(
                f"Checking `in {name}` scans a list, costing O(n) each time.",
                N,
                "medium" if name in self.params else "high",
                "The type of an input isn't known from the code; a list is assumed."
                if name in self.params
                else None,
            )
            return N
        return ONE

    def call_cost(self, node: ast.Call) -> Cost:
        name = _name(node.func)
        args = node.args
        # max(a, b) compares values; max(items) scans them.
        grows = len(args) == 1 and not _is_constant(args[0])
        if name == "sorted" or (name == "sort" and isinstance(node.func, ast.Attribute)):
            self.note("Sorting costs O(n log n).", N_LOG_N)
            if name == "sorted" and grows:
                self.grow_space(N, "Sorting makes a sorted copy of n items.")
            return N_LOG_N
        if name in HEAP_LOG:
            self.note("Each heap push or pop costs O(log n).", LOG)
            return LOG
        if name == "heapify":
            self.note("Building a heap costs O(n).", N)
            return N
        if name in {"nlargest", "nsmallest"}:
            self.note("Picking the largest or smallest items with a heap costs O(n log n) at most.", N_LOG_N)
            return N_LOG_N
        if name in LINEAR_BUILTINS and grows and isinstance(node.func, ast.Name):
            self.note(f"`{name}(…)` goes over all its items, costing O(n).", N)
            return N
        if isinstance(node.func, ast.Attribute):
            method = node.func.attr
            receiver = _name(node.func.value)
            if method == "pop" and args and not (isinstance(args[0], ast.UnaryOp)):
                if receiver not in self.hash_names and isinstance(args[0], ast.Constant) and args[0].value == 0:
                    self.note("`pop(0)` shifts every item of a list, costing O(n).", N)
                    return N
            if method == "insert" and args and isinstance(args[0], ast.Constant) and args[0].value == 0:
                self.note("`insert(0, …)` shifts every item of a list, costing O(n).", N)
                return N
            if method in LINEAR_METHODS - LAZY_METHODS and receiver not in self.hash_names:
                if method in {"index", "count", "remove"} or receiver in self.sequence_names:
                    self.note(f"`.{method}(…)` goes over the whole sequence, costing O(n).", N)
                    return N
                if method in {"join", "split", "replace", "copy", "extend"}:
                    return N
        callee = self.local_function(node)
        if callee is not None:
            return self.function_call_cost(callee)
        return ONE

    # Functions and recursion ------------------------------------------------------------------

    def local_function(self, node: ast.Call) -> ast.FunctionDef | None:
        func = node.func
        if isinstance(func, ast.Name) and func.id in self.functions:
            return self.functions[func.id]
        if (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Name)
            and func.value.id == "self"
            and func.attr in self.functions
        ):
            return self.functions[func.attr]
        return None

    def function_call_cost(self, function: ast.FunctionDef) -> Cost:
        name = function.name
        if name in self._active:
            return ONE  # a recursive call, costed by the recursion as a whole
        if name in self._function_costs:
            recursion = _recursion(function)
            if recursion and recursion.kind == "visited" and self.loop_depth > 0:
                return ONE
            return self._function_costs[name]
        self._active.add(name)
        saved_depth, self.loop_depth = self.loop_depth, 0
        saved_params = self.params
        self.params = self.params | {a.arg for a in function.args.args if a.arg != "self"}
        body = self.block(function.body)
        self.params = saved_params
        self.loop_depth = saved_depth
        self._active.discard(name)
        total = self.recursion_cost(function, body)
        self._function_costs[name] = total
        recursion = _recursion(function)
        if recursion and recursion.kind == "visited" and self.loop_depth > 0:
            return ONE
        return total

    def recursion_cost(self, function: ast.FunctionDef, per_call: Cost) -> Cost:
        recursion = _recursion(function)
        if recursion is None:
            return per_call
        name = function.name
        if recursion.kind == "memo":
            states = ONE
            for _ in range(min(recursion.params, 3)):
                states = states * N
            self.note(
                f"`{name}` is memoized: it runs once per distinct argument, about "
                f"{states.describe()[2:-1]} states.",
                states * per_call,
                "low",
                "For memoized recursion, each argument is assumed to take about n values.",
            )
            self.grow_space(states, f"The memo for `{name}` holds one entry per state.")
            return states * per_call
        if recursion.kind == "visited":
            self.note(
                f"`{name}` marks what it has visited, so each item is processed once overall.",
                N * per_call,
                "medium",
                "Recursion that marks visited items is assumed to visit each item once.",
            )
            self.grow_space(N, f"Recursion in `{name}` can go n calls deep.")
            return N * per_call
        if recursion.kind == "tree":
            self.note(
                f"`{name}` visits each node of a tree or list once.",
                N * per_call,
                "medium",
                "For trees, recursion depth is the tree's height: n at worst, log n when balanced.",
            )
            self.grow_space(N, f"Recursion in `{name}` goes as deep as the tree is tall (up to n).")
            return N * per_call
        if recursion.kind == "halving":
            self.note(f"`{name}` halves its input on each call.", LOG * per_call, "medium")
            self.grow_space(LOG, f"Recursion in `{name}` goes log n calls deep.")
            return LOG * per_call
        if recursion.kind == "linear":
            self.note(f"`{name}` calls itself once per step, about n times.", N * per_call, "medium")
            self.grow_space(N, f"Recursion in `{name}` goes about n calls deep.")
            return N * per_call
        self.note(
            f"`{name}` calls itself more than once without memoizing, so the calls branch out "
            "exponentially.",
            EXP,
            "low",
            "Branching recursion (backtracking) is bounded loosely by 2ⁿ; the real count depends "
            "on how much the search is cut short.",
        )
        self.grow_space(N, f"Recursion in `{name}` goes about n calls deep.")
        return EXP


def _self_calls(function: ast.FunctionDef) -> list[ast.Call]:
    calls = []
    for n in ast.walk(function):
        if not isinstance(n, ast.Call):
            continue
        func = n.func
        if (isinstance(func, ast.Name) and func.id == function.name) or (
            isinstance(func, ast.Attribute)
            and isinstance(func.value, ast.Name)
            and func.value.id == "self"
            and func.attr == function.name
        ):
            calls.append(n)
    return calls


def _recursion(function: ast.FunctionDef) -> _Recursion | None:
    calls = _self_calls(function)
    if not calls:
        return None
    params = len([a for a in function.args.args if a.arg != "self"])
    decorators = {_name(d.func if isinstance(d, ast.Call) else d) for d in function.decorator_list}
    if decorators & MEMO_DECORATORS:
        return _Recursion("memo", params)
    nodes = list(ast.walk(function))
    stored = {
        _name(n.value)
        for n in nodes
        if isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store)
    }
    checked = {
        _name(c)
        for n in nodes
        if isinstance(n, ast.Compare) and any(isinstance(op, (ast.In, ast.NotIn)) for op in n.ops)
        for c in n.comparators
    }
    added = {
        _name(n.func.value)
        for n in nodes
        if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute) and n.func.attr == "add"
    }
    memo_names = (stored & checked) - {None}
    if memo_names and not added:
        return _Recursion("memo", params)
    # Flood fill: marks cells or nodes as seen (a set, or by overwriting the grid) and stops at them.
    if (added & checked) - {None} or (len(calls) >= 2 and any(
        isinstance(n, ast.Subscript) and isinstance(n.ctx, ast.Store) and isinstance(n.value, ast.Subscript)
        for n in nodes
    )):
        return _Recursion("visited", params)
    if any(
        isinstance(a, ast.Attribute) and a.attr in TREE_LINKS
        for call in calls
        for a in ast.walk(call)
    ):
        return _Recursion("tree", params)
    in_loop = any(
        call in {c for loop in nodes if isinstance(loop, (ast.For, ast.While)) for c in ast.walk(loop)}
        for call in calls
    )
    if len(calls) == 1 and not in_loop:
        halving = any(
            isinstance(a, ast.BinOp) and isinstance(a.op, (ast.FloorDiv, ast.RShift))
            for a in ast.walk(calls[0])
        )
        return _Recursion("halving" if halving else "linear", params)
    return _Recursion("branching", params)


# ----------------------------------------------------------------------------------------------
# Entry point
# ----------------------------------------------------------------------------------------------


def _entry_points(tree: ast.Module) -> tuple[list[ast.FunctionDef], dict[str, ast.FunctionDef], bool]:
    """The method(s) to estimate, every function they might call, and whether it's a design class."""
    functions: dict[str, ast.FunctionDef] = {}
    for n in ast.walk(tree):
        if isinstance(n, ast.FunctionDef):
            functions.setdefault(n.name, n)
    classes = [n for n in tree.body if isinstance(n, ast.ClassDef)]
    solution = next((c for c in classes if c.name == "Solution"), None)
    if solution is not None:
        public = [
            n for n in solution.body if isinstance(n, ast.FunctionDef) and not n.name.startswith("_")
        ]
        return public[:1], functions, False
    if classes:
        methods = [
            n
            for n in classes[0].body
            if isinstance(n, ast.FunctionDef) and not n.name.startswith("__")
        ]
        return methods, functions, True
    top = [n for n in tree.body if isinstance(n, ast.FunctionDef)]
    return top[:1], functions, False


def analyze_python(code: str) -> Estimate:
    try:
        tree = ast.parse(code)
    except (SyntaxError, ValueError, RecursionError, MemoryError):
        return Estimate(
            status="unparseable",
            message="This code couldn't be read as Python, so it wasn't analyzed.",
        )
    try:
        return _estimate(tree)
    except RecursionError:
        return Estimate(
            status="unparseable",
            message="This code is nested too deeply to analyze.",
        )


def _estimate(tree: ast.Module) -> Estimate:
    entries, functions, design = _entry_points(tree)
    if not entries:
        return Estimate(
            status="unparseable",
            message="No function or Solution class was found to analyze.",
        )
    time = ONE
    analyzers = []
    for entry in entries:
        params = {a.arg for a in entry.args.args if a.arg != "self"}
        analyzer = _Analyzer(functions, params)
        analyzer._active.add(entry.name)
        cost = analyzer.recursion_cost(entry, analyzer.block(entry.body))
        time = max(time, cost)
        analyzers.append(analyzer)

    confidence: Confidence = min((a.confidence for a in analyzers), key=_RANK.__getitem__)
    findings = [f for a in analyzers for f in a.findings]
    findings.sort(key=lambda f: f.cost, reverse=True)
    reasons = []
    for f in findings:
        if f.text not in reasons:
            reasons.append(f.text)
    if not reasons:
        reasons.append("No loops over the input, sorting, or recursion were found.")
    space = max((a.space for a in analyzers), default=ONE)
    space_reasons = [r for a in analyzers for r in a.space_reasons]
    if space == ONE:
        space_reasons = ["Only a fixed number of variables are created."]
    limits = list(ALWAYS_LIMITS)
    for a in analyzers:
        limits += [limit for limit in a.limits if limit not in limits]
    if design:
        confidence = "low" if confidence == "low" else "medium"
        reasons.insert(0, "This is a class with several operations; the costliest one is shown.")
        limits.append("For design problems, each operation's own cost may differ from the one shown.")
    limits.append("Space counts everything the solution creates, including what it returns.")
    return Estimate(
        status="ok",
        time=time.describe(),
        space=space.describe(),
        confidence=confidence,
        reasons=reasons[:6] + space_reasons[:3],
        limitations=limits,
    )
