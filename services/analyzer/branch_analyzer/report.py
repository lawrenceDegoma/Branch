"""Turns the engine's costs into the estimate people read: letters, the "where" line, reasons."""

from __future__ import annotations

from .cost import ONE, Expr, Sym, Term, big_o, describe, sym
from .engine import HIGH, LOW, MEDIUM, Analysis, Finding

CONFIDENCE = {HIGH: "high", MEDIUM: "medium", LOW: "low"}


def merge_sizes(exprs: list[Expr]) -> dict[Sym, Expr]:
    """Sizes of the same kind (two strings' lengths) that never multiply each other become one:
    O(n·k + m·k) for s and t reads better, and is the same bound, as O(n·k) with n their total
    length. Sizes that do multiply (two strings in Longest Common Subsequence) stay apart: O(n·m)."""
    symbols = set().union(*(e.symbols() for e in exprs)) if exprs else set()
    groups: dict[str, list[Sym]] = {}
    for s in sorted(symbols, key=lambda s: s.order):
        groups.setdefault(s.group, []).append(s)
    mapping: dict[Sym, Expr] = {}
    for members in groups.values():
        if len(members) < 2:
            continue
        together = any(
            len({m for m in members if m in t.symbols()}) > 1 for e in exprs for t in e.terms
        )
        if together:
            continue
        first = members[0]
        merged = Sym(first.noun, " and ".join(dict.fromkeys(m.subject for m in members)), first.group, first.letters)
        merged.order = first.order
        for m in members:
            mapping[m] = sym(merged)
    return mapping


def drop_bounded(e: Expr) -> Expr:
    """Drop terms another term already covers given what's known about the sizes: a string
    has no more different characters than characters (k ≤ n), and a tree is no taller than its
    node count (h ≤ n). So O(n + k) is O(n) and O(n·k + k²) is O(n·k); O(n·k) stays."""
    lengths = [s for s in e.symbols() if s.group in ("str", "word")]
    nodes = [s for s in e.symbols() if s.group == "nodes"]
    kept = []
    for t in e.terms:
        covered = False
        for small, bigs in (("alphabet", lengths), ("height", nodes)):
            powers = dict(t.powers)
            for s, p in list(powers.items()):
                if s.group != small:
                    continue
                for big in bigs:
                    swapped = dict(powers)
                    swapped[s] = p - 1
                    swapped[big] = swapped.get(big, 0) + 1
                    swapped = {k: v for k, v in swapped.items() if v}
                    candidate = Term(tuple(sorted(swapped.items(), key=lambda kv: kv[0].order)), t.logs, t.exps)
                    if any(o is not t and o.dominates(candidate) for o in e.terms):
                        covered = True
        if not covered:
            kept.append(t)
    return Expr(kept)


def assign_names(symbols: set[Sym]) -> dict[Sym, str]:
    names: dict[Sym, str] = {}
    used: set[str] = set()
    for s in sorted(symbols, key=lambda s: (s.group == "alphabet", s.group == "height", s.order)):
        for letter in s.letters:
            if letter not in used:
                names[s] = letter
                used.add(letter)
                break
        else:
            names[s] = f"n{len(names) + 1}"
    return names


def meaning(s: Sym) -> str:
    if s.group == "alphabet":
        return "the number of different characters (at most 26 for lowercase letters)"
    if s.group == "height":
        return "the height of the tree (log of its size when balanced, its size at worst)"
    if s.noun == "value":
        return f"the value of `{s.subject}`"
    if s.noun in ("length of each string", "length of each list"):
        return f"the {s.noun} in `{s.subject}`"
    if s.noun in ("number of rows", "number of columns"):
        return f"the {s.noun} in `{s.subject}`"
    if s.noun == "largest value":
        return f"the largest value in `{s.subject}`"
    if not s.subject:
        return f"the {s.noun}"
    if s.subject.startswith("the "):
        return f"the {s.noun} in {s.subject}"
    subjects = " and ".join(f"`{part}`" for part in s.subject.split(" and "))
    return f"the {s.noun} of {subjects}"


def where_clause(symbols: set[Sym], names: dict[Sym, str]) -> str | None:
    parts = []
    for s in sorted(symbols, key=lambda s: (s.group == "alphabet", s.group == "height", s.order)):
        if s.noun == "value" and names[s] == s.subject:
            continue  # "n is the value of n" says nothing
        parts.append(f"{names[s]} is {meaning(s)}")
    if not parts:
        return None
    if len(parts) == 1:
        return f"Where {parts[0]}."
    return "Where " + ", ".join(parts[:-1]) + f", and {parts[-1]}."


def render(f: Finding, mapping: dict[Sym, Expr], names: dict[Sym, str]) -> str:
    text = f.template
    for i, e in enumerate(f.exprs):
        text = text.replace("{" + str(i) + "}", describe(e.subst(mapping) if mapping else e, names))
    return text


def build(
    a: Analysis,
    time: Expr,
    space: Expr,
    per_operation: list[tuple[str, Expr]] | None,
):
    """(time, space, confidence, reasons, limitations, notation, bound) as text."""
    exprs = [time, space, *[e for f in a.findings for e in f.exprs]]
    exprs += [cost for _, cost in per_operation or []]
    mapping = merge_sizes([time, space, *[cost for _, cost in per_operation or []]])
    time_m, space_m = drop_bounded(time.subst(mapping)), drop_bounded(space.subst(mapping))
    shown = time_m.symbols() | space_m.symbols()
    all_symbols = shown | set().union(*(e.subst(mapping).symbols() for e in exprs))
    names = assign_names(all_symbols)

    notation = where_clause(shown, names)
    alphabet = next((s for s in shown if s.group == "alphabet"), None)
    if alphabet is not None and notation:
        fixed = {alphabet: ONE}
        notation += (
            f" With a fixed alphabet, like lowercase letters, that's {big_o(time_m.subst(fixed), names)} time"
            f" and {big_o(space_m.subst(fixed), names)} space."
        )

    confidence = a.confidence
    limits = [
        "Estimated by reading the code, without running it. Big-O is the worst case; real inputs often finish sooner."
    ]
    if a.inputs.guessed:
        confidence = min(confidence, MEDIUM)
        limits.append("Some inputs have no type hints, so their types were guessed from their names.")
    limits += [limit for limit in a.limits if limit not in limits]
    limits.append("Space counts what the solution creates, including what it returns, but not its inputs.")

    reasons: list[str] = []
    if per_operation:
        confidence = min(confidence, MEDIUM)
        ops = ", ".join(f"{name} {big_o(cost.subst(mapping), names)}" for name, cost in per_operation)
        reasons.append(f"This class has several operations; the estimate is the costliest. Each one: {ops}.")
        limits.append("For classes with several operations, each operation is estimated on its own.")
    time_findings = sorted(
        (f for f in a.findings if f.kind == "time"),
        key=lambda f: (tuple(-x for x in f.cost.subst(mapping).rank()), f.line),
    )
    space_findings = [f for f in a.findings if f.kind == "space"]
    for f in time_findings:
        text = render(f, mapping, names)
        if text not in reasons:
            reasons.append(text)
        if len(reasons) >= 6:
            break
    for f in space_findings[:2]:
        text = render(f, mapping, names)
        if text not in reasons:
            reasons.append(text)
    if not reasons:
        reasons.append("No loops over the inputs, sorting, or recursion: everything runs a fixed number of times.")

    return (
        big_o(time_m, names),
        big_o(space_m, names),
        CONFIDENCE[confidence],
        reasons[:9],
        limits[:8],
        notation,
        a.upper,
    )
