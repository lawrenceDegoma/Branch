"""Branch's code analyzer. See complexity.py for the rules and app.py for the HTTP service."""

from .complexity import Estimate, analyze_python

#: Changes whenever the rules change, so Branch's cache never serves an outdated estimate.
ANALYZER_VERSION = "2026.11.4"

#: Language slugs (LeetCode's) the analyzer can read.
SUPPORTED_LANGUAGES = {"python3", "python"}


def analyze(language: str, code: str) -> Estimate | None:
    """The estimate, or None when the language isn't supported yet."""
    if language not in SUPPORTED_LANGUAGES:
        return None
    return analyze_python(code)


__all__ = ["ANALYZER_VERSION", "SUPPORTED_LANGUAGES", "Estimate", "analyze"]
