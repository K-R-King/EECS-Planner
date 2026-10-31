import httpx
import pytest
from fastapi.testclient import TestClient
from google.genai import errors

import backend.ai as ai
import backend.main as main
from backend.ai import AdvisorReply, PlanChange

client = TestClient(main.app)
SETTINGS = {"timeline": 4, "maxUnits": 16, "ap": {}}


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    monkeypatch.setattr(ai, "RETRY_DELAYS", [0, 0])
    main._advisor_calls.clear()


def fake_gemini(monkeypatch, *outcomes):
    """Each call to Gemini returns (or raises) the next outcome."""
    calls = iter(outcomes)

    class Response:
        def __init__(self, parsed):
            self.parsed = parsed
            self.text = ""

    def generate_content(**_):
        outcome = next(calls)
        if isinstance(outcome, Exception):
            raise outcome
        return Response(outcome)

    monkeypatch.setattr(ai.client.models, "generate_content", generate_content)


def plan():
    return client.post("/generate-plan", json={"settings": SETTINGS}).json()["plan"]


def ask(question="make it easier"):
    return client.post("/advisor", json={"plan": plan(), "question": question, "settings": SETTINGS}).json()


def test_catalog_and_ap_exams():
    courses = client.get("/courses").json()
    assert {"MATH51", "CS61A", "ELENG66", "CS162"} <= {c["code"] for c in courses}
    exams = client.get("/ap-exams").json()
    assert len(exams) == len(main.ap_exam_list())
    assert all({"key", "label", "group", "units", "credit"} <= set(e) for e in exams)


def test_advisor_applies_changes(monkeypatch):
    fake_gemini(monkeypatch, AdvisorReply(
        answer="Moved CS 188 later.",
        changes=[PlanChange(action="move", course="CS188", to_term="Year 4 Fall")],
    ))
    reply = ask()
    assert reply["error"] is False
    assert reply["changes"] == ["Moved CS188 → Year 4 Fall"]
    year4_fall = next(s for s in reply["result"]["plan"] if s["term"] == "Year 4 Fall")
    assert "CS188" in [c["code"] for c in year4_fall["courses"]]


def test_advisor_question_without_changes(monkeypatch):
    fake_gemini(monkeypatch, AdvisorReply(answer="CS 162 is Operating Systems.", changes=[]))
    reply = ask("what is cs 162?")
    assert reply == {"answer": "CS 162 is Operating Systems.", "error": False, "changes": [], "skipped": [], "result": None}


def server_error():
    return errors.ServerError(503, {"error": {"code": 503, "message": "high demand", "status": "UNAVAILABLE"}})


def test_advisor_retries_when_gemini_is_busy(monkeypatch):
    fake_gemini(monkeypatch, server_error(), AdvisorReply(answer="ok", changes=[]))
    assert ask()["answer"] == "ok"


@pytest.mark.parametrize("failure, message", [
    ([server_error()] * 3, ai.BUSY_MESSAGE),
    ([errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})], ai.LIMIT_MESSAGE),
    ([errors.ClientError(400, {"error": {"code": 400, "message": "bad key", "status": "INVALID_ARGUMENT"}})], ai.SETUP_MESSAGE),
    ([httpx.ConnectError("offline")], ai.OFFLINE_MESSAGE),
    ([ValueError("boom")], ai.GENERIC_MESSAGE),
])
def test_advisor_friendly_errors(monkeypatch, failure, message):
    fake_gemini(monkeypatch, *failure)
    reply = ask()
    assert reply["error"] is True
    assert reply["answer"] == message
    # no raw API error details leak into the chat
    assert "{" not in reply["answer"] and "UNAVAILABLE" not in reply["answer"]


def test_advisor_rate_limit(monkeypatch):
    monkeypatch.setattr(main, "ADVISOR_LIMIT", 2)
    fake_gemini(monkeypatch, *[AdvisorReply(answer="ok", changes=[])] * 3)
    assert ask()["error"] is False
    assert ask()["error"] is False
    limited = ask()
    assert limited["error"] is True
    assert "wait a minute" in limited["answer"]
