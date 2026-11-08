"""Symbolic costs: sums of products of sizes, with logarithms and exponentials.

A cost like O(n·k + m log m) is a sum of terms, each a product of sizes (symbols) raised to
powers, times logarithms, times exponentials or factorials. Sums keep only terms that aren't
dominated by another term, so O(n² + n) is O(n²) but O(n + m) stays O(n + m): with two different
sizes, neither is known to be larger.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import count

_order = count()


@dataclass(eq=False)
class Sym:
    """A size a cost depends on, such as the length of an input."""

    noun: str  # "length", "value", "number of different characters", "number of nodes", ...
    subject: str  # what it measures: "s", "the tree", "" when the noun says it all
    group: str  # sizes of the same group (two strings' lengths) can be merged into one
    letters: tuple[str, ...] = ("n", "m", "p", "q", "r", "u", "v", "w")
    order: int = field(default_factory=lambda: next(_order))

    def __post_init__(self):
        # Inputs are numbered as they're created; a size passed an explicit late order (the
        # alphabet) sorts after them, so it's written last: n·k, not k·n.
        pass

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"Sym({self.noun} of {self.subject})"


# A term: powers and logs of symbols, and exponentials. An exponential's base is an int (2ⁿ),
# a symbol (mⁿ), or 0 for a factorial (n!).
Base = int | Sym


@dataclass(frozen=True)
class Term:
    powers: tuple[tuple[Sym, int], ...] = ()
    logs: tuple[tuple[Sym, int], ...] = ()
    exps: tuple[tuple[Sym, Base], ...] = ()

    def symbols(self) -> set[Sym]:
        found = {s for s, _ in self.powers} | {s for s, _ in self.logs} | {s for s, _ in self.exps}
        found |= {b for _, b in self.exps if isinstance(b, Sym)}
        return found

    def key(self, s: Sym) -> tuple[int, int, int, int]:
        """How fast this term grows in `s`: factorial, then exponential, then power, then log."""
        fact = exp = 0
        for sym, base in self.exps:
            if sym is s:
                if base == 0:
                    fact = 1
                else:
                    exp = max(exp, 100 if isinstance(base, Sym) else int(base))
        power = next((p for sym, p in self.powers if sym is s), 0)
        log = next((p for sym, p in self.logs if sym is s), 0)
        return (fact, exp, power, log)

    def dominates(self, other: Term) -> bool:
        return all(self.key(s) >= other.key(s) for s in self.symbols() | other.symbols())

    def __mul__(self, other: Term) -> Term:
        def combine(a, b, cap):
            merged: dict[Sym, int] = {}
            for s, p in (*a, *b):
                merged[s] = min(merged.get(s, 0) + p, cap)
            return tuple(sorted(merged.items(), key=lambda item: item[0].order))

        exps: dict[Sym, Base] = {}
        for s, base in (*self.exps, *other.exps):
            current = exps.get(s)
            rank = lambda b: 1000 if b == 0 else (100 if isinstance(b, Sym) else int(b))  # noqa: E731
            if current is None or rank(base) > rank(current):
                exps[s] = base
        return Term(
            combine(self.powers, other.powers, 6),
            combine(self.logs, other.logs, 2),
            tuple(sorted(exps.items(), key=lambda item: item[0].order)),
        )

    def rank(self) -> tuple[int, int, int]:
        """For ordering terms largest first when displaying."""
        exp = max((1000 if b == 0 else 100 for _, b in self.exps), default=0)
        return (exp, sum(p for _, p in self.powers), sum(p for _, p in self.logs))


def _simplify(terms) -> frozenset[Term]:
    unique = list(dict.fromkeys(terms))
    kept: list[Term] = []
    for t in unique:
        if any(o is not t and o.dominates(t) and (not t.dominates(o) or unique.index(o) < unique.index(t)) for o in unique):
            continue
        kept.append(t)
    return frozenset(kept)


class Expr:
    """A sum of terms. The empty sum is zero (no cost); {Term()} is a constant."""

    __slots__ = ("terms",)

    def __init__(self, terms=()):
        self.terms: frozenset[Term] = _simplify(terms)

    def __add__(self, other: Expr) -> Expr:
        return Expr((*self.terms, *other.terms))

    def __mul__(self, other: Expr) -> Expr:
        return Expr(a * b for a in self.terms for b in other.terms)

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Expr) and self.terms == other.terms

    def __hash__(self) -> int:
        return hash(self.terms)

    def __bool__(self) -> bool:
        return bool(self.terms)

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"Expr({describe(self, default_names(self.symbols()))})"

    def symbols(self) -> set[Sym]:
        return set().union(*(t.symbols() for t in self.terms)) if self.terms else set()

    def is_constant(self) -> bool:
        return all(not t.symbols() for t in self.terms)

    def dominates(self, other: Expr) -> bool:
        """Every term of `other` is dominated by a term of this sum."""
        return all(any(a.dominates(b) for a in self.terms) for b in other.terms)

    def rank(self) -> tuple[int, int, int]:
        return max((t.rank() for t in self.terms), default=(-1, -1, -1))

    def subst(self, mapping: dict[Sym, Expr]) -> Expr:
        total = ZERO
        for t in self.terms:
            part = ONE
            for s, p in t.powers:
                image = mapping.get(s, sym(s))
                for _ in range(p):
                    part = part * image
            for s, p in t.logs:
                image = log_of(mapping.get(s, sym(s)))
                for _ in range(p):
                    part = part * image
            for s, base in t.exps:
                if isinstance(base, Sym) and base in mapping:
                    image_base = mapping[base]
                    base = next(iter(image_base.symbols()), 2) if not image_base.is_constant() else 2
                part = part * exp_of(mapping.get(s, sym(s)), base)
            total = total + part
        return total


ZERO = Expr()
ONE = Expr((Term(),))


def sym(s: Sym) -> Expr:
    return Expr((Term(powers=((s, 1),)),))


def larger(a: Expr, b: Expr) -> Expr:
    """An upper bound of both (their sum, simplified)."""
    return a + b


def smaller(a: Expr, b: Expr) -> Expr:
    """The smaller of two upper bounds when one is known to be smaller; otherwise `b`, the
    bound proven by an aggregate argument."""
    if b.dominates(a) and not a.dominates(b):
        return a
    return b


def log_of(e: Expr) -> Expr:
    """log of a size: log(n·m) = log n + log m, log(2ⁿ) = n, log of a constant is a constant."""
    if not e or e.is_constant():
        return ONE
    terms = []
    for t in e.terms:
        for s, base in t.exps:
            terms.append(Term(powers=((s, 1),)))
        for s, _ in t.powers:
            terms.append(Term(logs=((s, 1),)))
    return Expr(terms) if terms else ONE


def exp_of(e: Expr, base: Base) -> Expr:
    """base^e, or e! when base is 0, over the main symbol of e."""
    if not e or e.is_constant():
        return ONE
    main = max(e.terms, key=lambda t: t.rank())
    symbols = sorted({s for s, _ in main.powers}, key=lambda s: s.order)
    if not symbols:
        return e
    return Expr((Term(exps=((symbols[0], base),)),))


# --------------------------------------------------------------------------------------------
# Display
# --------------------------------------------------------------------------------------------

_SUPERSCRIPTS = {
    "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶",
    "n": "ⁿ", "m": "ᵐ", "k": "ᵏ", "h": "ʰ", "p": "ᵖ", "r": "ʳ", "a": "ᵃ", "c": "ᶜ",
    "u": "ᵘ", "v": "ᵛ", "w": "ʷ", "b": "ᵇ", "d": "ᵈ", "V": "ⱽ", "E": "ᴱ", "t": "ᵗ", "s": "ˢ",
}  # fmt: skip


def _sup(text: str) -> str:
    if all(ch in _SUPERSCRIPTS for ch in text):
        return "".join(_SUPERSCRIPTS[ch] for ch in text)
    return f"^{text}"


def default_names(symbols) -> dict[Sym, str]:
    names: dict[Sym, str] = {}
    used: set[str] = set()
    for s in sorted(symbols, key=lambda s: s.order):
        for letter in s.letters:
            if letter not in used:
                names[s] = letter
                used.add(letter)
                break
        else:
            names[s] = f"n{len(names)}"
    return names


def _term_text(t: Term, names: dict[Sym, str]) -> str:
    factors = [names[s] + (_sup(str(p)) if p > 1 else "") for s, p in t.powers]
    for s, base in t.exps:
        name = names[s]
        if base == 0:
            factors.append(f"{name}!")
        elif isinstance(base, Sym):
            factors.append(f"{names[base]}{_sup(name)}")
        else:
            factors.append(f"{base}{_sup(name)}")
    logs = " ".join(("log " if p == 1 else "log² ") + names[s] for s, p in t.logs)
    product = "·".join(factors)
    if product and logs:
        return f"{product} {logs}"
    return product or logs or "1"


def describe(e: Expr, names: dict[Sym, str]) -> str:
    """The sum without O(…): "n·k", "n + m", "1"."""
    if not e or e.is_constant():
        return "1"
    terms = sorted(
        (t for t in e.terms if t.symbols()),
        key=lambda t: (
            tuple(-x for x in t.rank()),
            min((s.order for s in t.symbols()), default=0),
            _term_text(t, names),
        ),
    )
    return " + ".join(_term_text(t, names) for t in terms)


def big_o(e: Expr, names: dict[Sym, str]) -> str:
    return f"O({describe(e, names)})"
