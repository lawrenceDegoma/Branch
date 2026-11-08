"""What a value is and how big it can get: the analyzer's types.

Each input gets its own size symbols from its type hint (LeetCode's Python code always has them),
or from its name when there's no hint. Values computed from inputs carry sizes derived from
them: `set(s)` holds at most one entry per different character, `nums[:k]` at most len(nums).
"""

from __future__ import annotations

import ast
from dataclasses import dataclass

from .cost import ONE, ZERO, Expr, Sym, sym


@dataclass(frozen=True)
class Num:
    """A number. `value` bounds its magnitude when it sizes something (range(n), [0] * n)."""

    value: Expr | None = None


@dataclass(frozen=True)
class Char:
    """One character of a string: there are at most `alphabet` different ones."""


@dataclass(frozen=True)
class Str:
    length: Expr


@dataclass(frozen=True)
class Seq:
    """A list, tuple, deque, or range. `parts` are a small tuple's known items."""

    length: Expr
    elem: Type
    kind: str = "list"
    parts: tuple[Type, ...] | None = None


@dataclass(frozen=True)
class SetT:
    length: Expr
    elem: Type


@dataclass(frozen=True)
class MapT:
    length: Expr
    key: Type
    value: Type


@dataclass(frozen=True)
class Tree:
    nodes: Expr
    height: Expr


@dataclass(frozen=True)
class Linked:
    length: Expr


@dataclass(frozen=True)
class Graph:
    """A graph node with `.neighbors` (Clone Graph): `nodes` and `edges` of the whole graph."""

    nodes: Expr
    edges: Expr


@dataclass(frozen=True)
class Unknown:
    pass


Type = Num | Char | Str | Seq | SetT | MapT | Tree | Linked | Graph | Unknown
UNKNOWN = Unknown()
SCALAR = Num()


def size(t: Type) -> Expr:
    """How many items it holds (or its magnitude, for numbers)."""
    if isinstance(t, (Str, Seq, SetT, MapT, Linked)):
        return t.length
    if isinstance(t, (Tree, Graph)):
        return t.nodes
    if isinstance(t, Num) and t.value is not None:
        return t.value
    return ONE


def is_collection(t: Type) -> bool:
    return isinstance(t, (Str, Seq, SetT, MapT))


def elem(t: Type) -> Type:
    """What iterating over it yields."""
    if isinstance(t, Str):
        return Char()
    if isinstance(t, (Seq, SetT)):
        return t.elem
    if isinstance(t, MapT):
        return t.key
    if isinstance(t, Num):
        return Num(t.value)
    return UNKNOWN


def deep_size(t: Type) -> Expr:
    """Everything it holds, nested lists included (a grid's rows times columns)."""
    if isinstance(t, Seq) and is_collection(t.elem):
        return t.length * deep_size(t.elem)
    if isinstance(t, MapT):
        # Each entry: the key (a sorted tuple per word, in Group Anagrams) and the value.
        per_entry = ONE
        if is_collection(t.key):
            per_entry = per_entry + deep_size(t.key)
        if is_collection(t.value):
            per_entry = per_entry + deep_size(t.value)
        return t.length * per_entry
    if isinstance(t, SetT) and is_collection(t.elem):
        return t.length * (ONE + deep_size(t.elem))
    return size(t) if is_collection(t) else ZERO


def with_length(t: Type, length: Expr) -> Type:
    if isinstance(t, Str):
        return Str(length)
    if isinstance(t, Seq):
        return Seq(length, t.elem, t.kind, None)
    if isinstance(t, SetT):
        return SetT(length, t.elem)
    if isinstance(t, MapT):
        return MapT(length, t.key, t.value)
    return t


def join(a: Type | None, b: Type) -> Type:
    """A type covering both (a variable assigned twice)."""
    if a is None or isinstance(a, Unknown):
        return b
    if isinstance(b, Unknown):
        return a
    if type(a) is not type(b):
        if isinstance(a, Num) and a.value is None:
            return b
        return a
    if isinstance(a, Num):
        if a.value is None:
            return b
        return a if b.value is None else Num(a.value + b.value)
    if isinstance(a, Str):
        return Str(a.length + b.length)
    if isinstance(a, Seq):
        return Seq(a.length + b.length, join(a.elem, b.elem), a.kind, a.parts if a.parts == b.parts else None)
    if isinstance(a, SetT):
        return SetT(a.length + b.length, join(a.elem, b.elem))
    if isinstance(a, MapT):
        return MapT(a.length + b.length, join(a.key, b.key), join(a.value, b.value))
    return a


# --------------------------------------------------------------------------------------------
# Inputs: from type hints, or from names when there are none
# --------------------------------------------------------------------------------------------

GRID_NAMES = ("grid", "board", "matrix", "mat", "image", "land", "maze", "heights", "dungeon", "triangle", "picture")
STRING_NAMES = {"s", "t", "word", "text", "text1", "text2", "word1", "word2", "pattern", "p", "str", "string", "digits", "num1", "num2", "a", "b", "s1", "s2", "s3", "path", "sentence", "beginWord", "endWord", "order"}  # fmt: skip
STRINGS_NAMES = {"strs", "words", "wordList", "wordDict", "tokens", "names", "dictionary", "sentences"}
LIST_NAMES = {"nums", "nums1", "nums2", "arr", "array", "prices", "height", "heights", "piles", "coins", "temperatures", "cost", "costs", "candidates", "weights", "stones", "position", "speed", "ratings", "gas", "hand", "tasks", "intervals", "points", "edges", "prerequisites", "times", "flights", "trips", "queries", "pairs", "envelopes", "people", "cards", "values", "scores", "citations"}  # fmt: skip
NUMBER_NAMES = {"n", "k", "m", "x", "target", "amount", "numCourses", "capacity", "limit", "threshold", "num", "val", "goal", "low", "high", "left", "right", "start", "end", "maxDoubles", "groupSize", "h", "w"}  # fmt: skip


class Inputs:
    """Makes size symbols for a function's parameters."""

    def __init__(self):
        self.guessed = False

    def length(self, name: str, noun: str = "length", group: str = "list") -> Expr:
        return sym(Sym(noun, name, group))

    def from_param(self, name: str, annotation: ast.expr | None) -> Type:
        if annotation is not None:
            t = self.from_annotation(name, annotation)
            if t is not None:
                return t
        self.guessed = True
        return self.from_name(name)

    def from_annotation(self, name: str, node: ast.expr) -> Type | None:
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            try:
                node = ast.parse(node.value, mode="eval").body
            except SyntaxError:
                return None
        head, args = _split(node)
        if head in ("Optional", "Union") and args:
            return self.from_annotation(name, args[0])
        if head in ("str",):
            return Str(self.length(name, group="str"))
        if head in ("int", "float", "bool"):
            return Num(sym(Sym("value", name, "value", (name,) if len(name) == 1 else ("n", "m", "p", "q", "r", "u", "v", "w"))))
        if head in ("TreeNode",):
            return _tree()
        if head in ("ListNode",):
            return Linked(self.length(name, group="linked"))
        if head in ("Node",):
            return Graph(sym(Sym("number of nodes", "the graph", "nodes", ("V", "n"))), sym(Sym("number of edges", "the graph", "edges", ("E", "m"))))
        if head in ("List", "list", "Sequence", "Deque", "deque") and args:
            inner_head, _ = _split(args[0])
            if inner_head in ("List", "list"):
                return self.two_dimensional(name, args[0])
            # The list's own length is created (and so named) before its items' lengths.
            length = self.length(name)
            return Seq(length, self.item(name, args[0]), "deque" if head.lower() == "deque" else "list")
        if head in ("Set", "set") and args:
            length = self.length(name)
            return SetT(length, self.item(name, args[0]))
        if head in ("Dict", "dict") and len(args) == 2:
            length = self.length(name, "number of entries")
            return MapT(length, self.item(name, args[0]), self.item(name, args[1]))
        return None

    def item(self, name: str, node: ast.expr) -> Type:
        head, _ = _split(node)
        if head == "str":
            return Str(self.length(name, "length of each string", "word"))
        if head in ("TreeNode",):
            return _tree()
        if head in ("ListNode",):
            return Linked(self.length(name, "length of each list", "linked"))
        return SCALAR

    def two_dimensional(self, name: str, inner: ast.expr) -> Type:
        _, args = _split(inner)
        cell = self.item(name, args[0]) if args else SCALAR
        if any(word in name.lower() for word in GRID_NAMES):
            rows = sym(Sym("number of rows", name, "rows", ("m", "n", "p", "q")))
            cols = sym(Sym("number of columns", name, "cols", ("n", "m", "p", "q")))
            return Seq(rows, Seq(cols, cell), "list")
        # Edge lists, intervals, points: many small pairs.
        return Seq(self.length(name), Seq(ONE, cell), "list")

    def from_name(self, name: str) -> Type:
        lower = name.lower()
        if name in STRINGS_NAMES:
            length = self.length(name)
            return Seq(length, Str(self.length(name, "length of each string", "word")))
        if any(word in lower for word in GRID_NAMES):
            return Seq(sym(Sym("number of rows", name, "rows", ("m", "n"))), Seq(sym(Sym("number of columns", name, "cols", ("n", "m"))), SCALAR))
        if name in STRING_NAMES:
            return Str(self.length(name, group="str"))
        if name in ("root", "tree", "node", "subRoot", "p", "q") or lower.endswith("root"):
            return _tree()
        if name in ("head", "l1", "l2", "list1", "list2", "headA", "headB") or lower.endswith("head"):
            return Linked(self.length(name, group="linked"))
        if name in NUMBER_NAMES:
            return Num(sym(Sym("value", name, "value", (name,) if len(name) == 1 else ("n", "m", "p", "q"))))
        if name in LIST_NAMES or lower.endswith("s"):
            return Seq(self.length(name), SCALAR)
        return UNKNOWN


def _tree() -> Tree:
    return Tree(
        sym(Sym("number of nodes", "the tree", "nodes")),
        sym(Sym("height", "the tree", "height", ("h",))),
    )


def _split(node: ast.expr) -> tuple[str | None, list[ast.expr]]:
    """`List[int]` → ("List", [int]); `int` → ("int", [])."""
    if isinstance(node, ast.Subscript):
        head = node.value.attr if isinstance(node.value, ast.Attribute) else getattr(node.value, "id", None)
        inner = node.slice
        args = list(inner.elts) if isinstance(inner, ast.Tuple) else [inner]
        return head, args
    if isinstance(node, ast.Name):
        return node.id, []
    if isinstance(node, ast.Attribute):
        return node.attr, []
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.BitOr):  # X | None
        left = _split(node.left)
        return left if left[0] != "None" else _split(node.right)
    if isinstance(node, ast.Constant) and node.value is None:
        return "None", []
    return None, []
