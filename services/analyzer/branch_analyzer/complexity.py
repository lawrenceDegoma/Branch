"""Estimates a Python solution's time and space complexity by reading it, never running it.

The work happens in engine.py (an abstract interpretation of the code: types and sizes, how
many times each line runs, what each operation costs, how recursion unfolds) and report.py
(turning that into an estimate with named sizes, reasons, and limits).
"""

from __future__ import annotations

import ast
from dataclasses import dataclass, field
from typing import Literal

from .engine import analyze_tree
from .report import build

Confidence = Literal["low", "medium", "high"]


@dataclass
class Estimate:
    status: Literal["ok", "unparseable"]
    time: str | None = None
    space: str | None = None
    confidence: Confidence | None = None
    reasons: list[str] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    #: What the letters stand for: "Where n is the length of `s`, …".
    notation: str | None = None
    #: True when the estimate is a ceiling the code may never reach ("at most").
    bound: bool = False
    message: str | None = None


def analyze_python(code: str) -> Estimate:
    try:
        tree = ast.parse(code)
    except (SyntaxError, ValueError, RecursionError, MemoryError):
        return Estimate(
            status="unparseable",
            message="This code couldn't be read as Python, so it wasn't analyzed.",
        )
    try:
        result = analyze_tree(tree)
        if result is not None:
            analysis, time, space, per_operation = result
            built = build(analysis, time, space, per_operation)
    except RecursionError:
        return Estimate(status="unparseable", message="This code is nested too deeply to analyze.")
    except Exception:  # never fail the request over code the rules don't handle
        return Estimate(
            status="unparseable",
            message="This solution uses something the analyzer can't read yet, so it wasn't analyzed.",
        )
    if result is None:
        return Estimate(
            status="unparseable",
            message="No function or Solution class was found to analyze.",
        )
    time_text, space_text, confidence, reasons, limits, notation, bound = built
    return Estimate(
        status="ok",
        time=time_text,
        space=space_text,
        confidence=confidence,
        reasons=reasons,
        limitations=limits,
        notation=notation,
        bound=bound,
    )
