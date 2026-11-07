"""Branch's analyzer as a small HTTP service (deployed as its own Vercel project).

Stateless: it reads the code it's given, answers, and keeps nothing. It never runs the code and
never logs it. Only Branch's server may call it, with the shared secret ANALYZER_SECRET.
"""

import hmac
import os
from typing import Literal

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from branch_analyzer import ANALYZER_VERSION, SUPPORTED_LANGUAGES, analyze

CODE_MAX = 100_000
BODY_MAX_BYTES = 256_000
SECRET_MIN_LENGTH = 32

app = FastAPI(title="Branch analyzer", docs_url=None, redoc_url=None, openapi_url=None)


def require_branch(request: Request, authorization: str | None = Header(default=None)) -> None:
    secret = os.environ.get("ANALYZER_SECRET", "")
    if len(secret) < SECRET_MIN_LENGTH:
        raise HTTPException(status_code=503, detail="The analyzer isn't configured.")
    given = (authorization or "").removeprefix("Bearer ")
    if not hmac.compare_digest(given.encode(), secret.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized.")
    length = request.headers.get("content-length")
    if length is not None and (not length.isdigit() or int(length) > BODY_MAX_BYTES):
        raise HTTPException(status_code=413, detail="Too large.")


class AnalyzeRequest(BaseModel):
    language: str = Field(pattern=r"^[A-Za-z0-9+#._-]{1,40}$")
    code: str = Field(min_length=1, max_length=CODE_MAX)


class AnalyzeResponse(BaseModel):
    analyzerVersion: str
    status: Literal["ok", "unparseable", "unsupported"]
    time: str | None = None
    space: str | None = None
    confidence: Literal["low", "medium", "high"] | None = None
    reasons: list[str] = []
    limitations: list[str] = []
    message: str | None = None


@app.get("/version", dependencies=[Depends(require_branch)])
def version() -> dict:
    return {"analyzerVersion": ANALYZER_VERSION, "languages": sorted(SUPPORTED_LANGUAGES)}


@app.post("/analyze", dependencies=[Depends(require_branch)])
def analyze_code(body: AnalyzeRequest) -> AnalyzeResponse:
    estimate = analyze(body.language, body.code)
    if estimate is None:
        return AnalyzeResponse(
            analyzerVersion=ANALYZER_VERSION,
            status="unsupported",
            message="Only Python solutions are analyzed so far.",
        )
    return AnalyzeResponse(
        analyzerVersion=ANALYZER_VERSION,
        status=estimate.status,
        time=estimate.time,
        space=estimate.space,
        confidence=estimate.confidence,
        reasons=estimate.reasons,
        limitations=estimate.limitations,
        message=estimate.message,
    )
