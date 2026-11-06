from types import SimpleNamespace

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
    main._rating_calls.clear()
    ai._ratings.clear()


@pytest.fixture(autouse=True)
def no_real_gemini(monkeypatch):
    def unexpected(**_):
        raise AssertionError("a test tried to call the real Gemini API")
    fake = SimpleNamespace(models=SimpleNamespace(generate_content=unexpected, generate_content_stream=unexpected))
    monkeypatch.setattr(ai, "get_client", lambda: fake)


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

    monkeypatch.setattr(ai.get_client().models, "generate_content", generate_content)


def plan():
    return client.post("/generate-plan", json={"settings": SETTINGS}).json()["plan"]


def ask(question="make it easier"):
    return client.post("/advisor", json={"plan": plan(), "question": question, "settings": SETTINGS}).json()


def valid_move(code="CS188"):
    """A semester `code` can move to without breaking any rule (so the advisor won't try to repair it)."""
    current = plan()
    review = client.post("/review-plan", json={"plan": current, "settings": SETTINGS}).json()
    for target in current:
        if code in [c["code"] for c in target["courses"]]:
            continue
        moved = [{"term": s["term"], "courses": [c["code"] for c in s["courses"] if c["code"] != code]
                  + ([code] if s["term"] == target["term"] else [])} for s in current]
        checked = client.post("/review-plan", json={"plan": moved, "settings": SETTINGS}).json()
        if checked["issues"] == review["issues"] and checked["warnings"] == review["warnings"]:
            return target["term"]
    raise AssertionError(f"no valid place to move {code}")


def test_catalog_and_ap_exams():
    courses = client.get("/courses").json()
    assert {"MATH51", "CS61A", "ELENG66", "CS162"} <= {c["code"] for c in courses}
    exams = client.get("/ap-exams").json()
    assert len(exams) == len(main.ap_exam_list())
    assert all({"key", "label", "group", "units", "credit"} <= set(e) for e in exams)


def test_advisor_applies_changes(monkeypatch):
    target = valid_move()
    fake_gemini(monkeypatch, AdvisorReply(
        answer="Moved CS 188.",
        changes=[PlanChange(action="move", course="CS188", to_term=target)],
    ))
    reply = ask()
    assert reply["error"] is False
    assert reply["changes"] == [f"Moved CS188 → {target}"]
    moved_to = next(s for s in reply["result"]["plan"] if s["term"] == target)
    assert "CS188" in [c["code"] for c in moved_to["courses"]]


def test_advisor_corrects_edits_that_break_rules(monkeypatch):
    target = valid_move()
    fake_gemini(
        monkeypatch,
        # first try: CS 189 in Year 1 Fall breaks prerequisites and the unit limit
        AdvisorReply(answer="first try", changes=[PlanChange(action="move", course="CS189", to_term="Year 1 Fall")]),
        AdvisorReply(answer="corrected", changes=[PlanChange(action="move", course="CS188", to_term=target)]),
    )
    reply = ask()
    assert reply["answer"] == "corrected"
    assert reply["changes"] == [f"Moved CS188 → {target}"]


def test_advisor_keeps_the_first_try_if_the_correction_is_no_better(monkeypatch):
    bad = AdvisorReply(answer="first try", changes=[PlanChange(action="move", course="CS189", to_term="Year 1 Fall")])
    fake_gemini(monkeypatch, bad, AdvisorReply(answer="worse", changes=bad.changes + [
        PlanChange(action="move", course="CS162", to_term="Year 1 Fall")]))
    assert ask()["answer"] == "first try"


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


# ---------- validation ----------

@pytest.mark.parametrize("settings", [
    {"maxUnits": "abc"},
    {"maxUnits": 40},
    {"timeline": 5},
    {"ap": {"notAnExam": 5}},
    {"ap": {"calcBC": 9}},
    {"focus": "basketweaving"},
    {"completed": ["CS999"]},
])
def test_bad_settings_are_rejected_clearly(settings):
    response = client.post("/generate-plan", json={"settings": settings})
    assert response.status_code == 422


def test_bad_plan_and_question_are_rejected():
    assert client.post("/review-plan", json={"plan": [{"term": "Year 9 Winter", "courses": []}]}).status_code == 422
    assert client.post("/advisor", json={"plan": [], "question": ""}).status_code == 422
    assert client.post("/advisor", json={"plan": [], "question": "x" * 5000}).status_code == 422


def test_focus_tracks_endpoint():
    data = client.get("/focus-tracks").json()
    assert {"balanced", "ai", "hardware"} <= {t["key"] for t in data["tracks"]}
    assert data["offerings_checked"]


# ---------- streaming ----------

def fake_stream(monkeypatch, *chunks):
    class Chunk:
        def __init__(self, text):
            self.text = text

    def generate_content_stream(**_):
        for chunk in chunks:
            if isinstance(chunk, Exception):
                raise chunk
            yield Chunk(chunk)

    monkeypatch.setattr(ai.get_client().models, "generate_content_stream", generate_content_stream)


def stream(question="make it easier"):
    with client.stream("POST", "/advisor/stream", json={"plan": plan(), "question": question, "settings": SETTINGS}) as r:
        return [__import__("json").loads(line) for line in r.iter_lines() if line]


def test_stream_sends_answer_pieces_then_the_proposal(monkeypatch):
    target = valid_move()
    fake_stream(monkeypatch, '{"answer": "Moving ', 'CS 188 later.", "changes": [',
                f'{{"action": "move", "course": "CS188", "to_term": "{target}"}}]}}')
    events = stream()
    deltas = "".join(e["text"] for e in events if e["type"] == "delta")
    done = events[-1]
    assert deltas == "Moving CS 188 later."
    assert done["type"] == "done" and done["changes"] == [f"Moved CS188 → {target}"]
    assert done["result"] is not None
    assert not any(e["type"] == "status" for e in events)


def test_stream_says_when_it_is_double_checking(monkeypatch):
    target = valid_move()
    fake_stream(monkeypatch, '{"answer": "first try", "changes": [{"action": "move", "course": "CS189", "to_term": "Year 1 Fall"}]}')
    fake_gemini(monkeypatch, AdvisorReply(answer="corrected", changes=[PlanChange(action="move", course="CS188", to_term=target)]))
    events = stream()
    assert {"type": "status", "text": "Double-checking those changes…"} in events
    assert events[-1]["answer"] == "corrected"


def test_stream_retries_then_reports_friendly_error(monkeypatch):
    fake_stream(monkeypatch, server_error())
    events = stream()
    assert events == [{"type": "done", **main.error_reply(ai.BUSY_MESSAGE)}]


# ---------------- setup, rate limit, prompt ----------------

def test_planner_works_without_a_gemini_key(monkeypatch):
    monkeypatch.setattr(ai, "get_client", lambda: None)
    assert client.get("/courses").status_code == 200
    assert plan()
    reply = ask()
    assert reply["error"] and reply["answer"] == ai.SETUP_MESSAGE
    with client.stream("POST", "/advisor/stream", json={"plan": plan(), "question": "hi", "settings": SETTINGS}) as r:
        events = [line for line in r.iter_lines() if line]
    assert '"done"' in events[-1] and "isn't set up" in events[-1]


def test_get_client_is_none_without_a_key(monkeypatch):
    monkeypatch.undo()  # the real get_client
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setattr(ai, "_client", None)
    assert ai.get_client() is None


def limited_ask(headers):
    return client.post("/advisor", json={"plan": [], "question": "hi", "settings": SETTINGS}, headers=headers).json()


def test_forged_forwarded_for_headers_dont_reset_the_limit(monkeypatch):
    monkeypatch.setattr(main, "ADVISOR_LIMIT", 2)
    monkeypatch.setattr(main, "CLIENT_IP_HEADER", "true-client-ip")
    fake_gemini(monkeypatch, *[AdvisorReply(answer="ok", changes=[])] * 2)
    replies = [limited_ask({"true-client-ip": "1.1.1.1", "x-forwarded-for": f"9.9.9.{i}"}) for i in range(3)]
    assert [r["answer"] for r in replies] == ["ok", "ok", main.RATE_LIMIT_MESSAGE]


def test_each_visitor_gets_their_own_limit(monkeypatch):
    monkeypatch.setattr(main, "ADVISOR_LIMIT", 1)
    monkeypatch.setattr(main, "CLIENT_IP_HEADER", "true-client-ip")
    fake_gemini(monkeypatch, *[AdvisorReply(answer="ok", changes=[])] * 2)
    assert limited_ask({"true-client-ip": "1.1.1.1"})["answer"] == "ok"
    assert limited_ask({"true-client-ip": "2.2.2.2"})["answer"] == "ok"
    assert limited_ask({"true-client-ip": "1.1.1.1"})["answer"] == main.RATE_LIMIT_MESSAGE


def test_idle_visitors_are_forgotten(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(main.time, "monotonic", lambda: now[0])
    monkeypatch.setattr(main, "_last_sweep", 0.0)
    fake_gemini(monkeypatch, *[AdvisorReply(answer="ok", changes=[])] * 2)
    limited_ask({})
    assert len(main._advisor_calls) == 1
    now[0] += 120
    main._advisor_calls["someone else"].append(now[0])
    limited_ask({})
    assert "someone else" in main._advisor_calls and len(main._advisor_calls) == 2
    now[0] += 120
    main._forget_idle_visitors(now[0])
    assert not main._advisor_calls


def test_prompt_catalog_is_compact_but_complete():
    import json
    slim = json.loads(ai.prompt_catalog())
    assert {c["code"] for c in slim} == {c["code"] for c in client.get("/courses").json()}
    assert all("description" not in c for c in slim)
    assert len(ai.prompt_catalog()) < 0.75 * len(json.dumps(client.get("/courses").json()))


def test_picked_electives_are_checked():
    ok = client.post("/generate-plan", json={"settings": {**SETTINGS, "electives": ["cs 189", "CS189"]}})
    assert ok.status_code == 200
    assert client.post("/generate-plan", json={"settings": {**SETTINGS, "electives": ["CS61A"]}}).status_code == 422
    assert client.post("/generate-plan", json={"settings": {**SETTINGS, "electives": ["CS999"]}}).status_code == 422


def test_advisor_is_told_about_picked_electives():
    prompt = ai.build_prompt([], "hi", {"electives": ["CS189"]}, [], [], [])
    assert "Electives the student picked" in prompt and "CS189" in prompt


# ---------- semester difficulty ----------

def rated(*semesters):
    """Asks for ratings of these semesters, one per year."""
    plan = [{"term": f"Year {i + 1} Fall", "courses": courses} for i, courses in enumerate(semesters)]
    response = client.post("/rate-semesters", json={"plan": plan})
    assert response.status_code == 200
    return response.json()["ratings"]


def ratings_reply(*difficulties):
    return ai.RatingReply(ratings=[ai.SemesterRating(semester=i, difficulty=d) for i, d in enumerate(difficulties)])


def test_semesters_are_rated_in_one_request(monkeypatch):
    fake_gemini(monkeypatch, ratings_reply(7, 4))  # a second request would run out of outcomes

    assert rated(["CS162", "CS170"], ["R1A"], []) == {"Year 1 Fall": 7, "Year 2 Fall": 4}


def test_a_rated_semester_keeps_its_rating_in_any_order(monkeypatch):
    fake_gemini(monkeypatch, ratings_reply(7))
    assert rated(["CS162", "CS170"]) == {"Year 1 Fall": 7}
    assert rated(["CS170", "CS162"]) == {"Year 1 Fall": 7}  # no second Gemini request


def test_the_chosen_course_changes_what_is_rated(monkeypatch):
    fake_gemini(monkeypatch, ratings_reply(5), ratings_reply(6))
    plan = {"plan": [{"term": "Year 1 Fall", "courses": ["PHYS7A"]}]}

    assert client.post("/rate-semesters", json=plan).json()["ratings"] == {"Year 1 Fall": 5}
    picked = {**plan, "settings": {"picks": {"PHYS7A": "PHYSICS 5A"}}}
    assert client.post("/rate-semesters", json=picked).json()["ratings"] == {"Year 1 Fall": 6}


@pytest.mark.parametrize("difficulty", [0, 11])
def test_ratings_outside_one_to_ten_are_dropped(monkeypatch, difficulty):
    fake_gemini(monkeypatch, ratings_reply(difficulty))
    assert rated(["CS162"]) == {"Year 1 Fall": None}


def test_a_failed_rating_leaves_the_semester_unrated(monkeypatch):
    fake_gemini(monkeypatch, server_error(), server_error(), server_error())
    assert rated(["CS162"]) == {"Year 1 Fall": None}


def test_rating_retries_when_gemini_is_busy(monkeypatch):
    fake_gemini(monkeypatch, server_error(), ratings_reply(8))
    assert rated(["CS162"]) == {"Year 1 Fall": 8}


def test_ratings_have_their_own_limit_and_rated_semesters_skip_it(monkeypatch):
    monkeypatch.setattr(main, "RATING_LIMIT", 1)
    fake_gemini(monkeypatch, ratings_reply(7))

    assert rated(["CS162"]) == {"Year 1 Fall": 7}
    assert rated(["CS170"]) == {"Year 1 Fall": None}  # over the limit, so Gemini isn't asked
    assert rated(["CS162"]) == {"Year 1 Fall": 7}
    assert not main._advisor_calls


def test_rating_unknown_courses_is_rejected():
    response = client.post("/rate-semesters", json={"plan": [{"term": "Year 1 Fall", "courses": ["NOPE1"]}]})
    assert response.status_code == 422
