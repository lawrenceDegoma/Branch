import pytest
from fastapi.testclient import TestClient

from app import app

SECRET = "s" * 40
client = TestClient(app)
auth = {"Authorization": f"Bearer {SECRET}"}


@pytest.fixture(autouse=True)
def secret(monkeypatch):
    monkeypatch.setenv("ANALYZER_SECRET", SECRET)


def test_analyzes_python():
    response = client.post(
        "/analyze",
        headers=auth,
        json={"language": "python3", "code": "def f(nums):\n    return sorted(nums)"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["time"] == "O(n log n)"
    assert body["analyzerVersion"]
    assert body["reasons"] and body["limitations"]
    assert body["notation"] == "Where n is the length of `nums`."
    assert body["bound"] is False


def test_says_when_a_language_isnt_supported():
    response = client.post("/analyze", headers=auth, json={"language": "java", "code": "class A {}"})
    assert response.json()["status"] == "unsupported"


def test_reports_its_version():
    assert client.get("/version", headers=auth).json()["languages"] == ["python", "python3"]


def test_refuses_callers_without_the_secret():
    assert client.post("/analyze", json={"language": "python3", "code": "x"}).status_code == 401
    wrong = {"Authorization": "Bearer " + "t" * 40}
    assert client.get("/version", headers=wrong).status_code == 401


def test_refuses_everything_until_a_secret_is_configured(monkeypatch):
    monkeypatch.setenv("ANALYZER_SECRET", "short")
    assert client.get("/version", headers={"Authorization": "Bearer short"}).status_code == 503


def test_validates_input():
    too_long = {"language": "python3", "code": "x" * 100_001}
    assert client.post("/analyze", headers=auth, json=too_long).status_code in (413, 422)
    assert client.post("/analyze", headers=auth, json={"language": "py thon", "code": "x"}).status_code == 422
    assert client.post("/analyze", headers=auth, json={"language": "python3", "code": ""}).status_code == 422


def test_has_no_public_docs():
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
