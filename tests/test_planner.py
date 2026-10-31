import itertools

import pytest

from backend.core import (
    FULL_TIME_UNITS, ap_credit, apply_changes, build_degree_plan, build_terms, review_plan,
)
from backend.curriculum import AP_EXAMS, COURSES, TOTAL_UNITS, UPPER_EECS_UNITS

AP_PROFILES = [
    {},
    {"calcBC": 5},
    {"calcBC": 3, "physicsCMech": 5, "englishLang": 4, "usHistory": 5, "spanishLang": 4, "chemistry": 3},
    {exam: 5 for exam in AP_EXAMS},
]

ALL_SETTINGS = [
    {"timeline": t, "maxUnits": u, "ap": ap, "summer": summer}
    for t, u, ap, summer in itertools.product([4, 3.5, 3], range(12, 21), AP_PROFILES, [False, True])
]


def codes(semester):
    return [c["code"] for c in semester["courses"]]


# ---------- generated plans follow every rule ----------

@pytest.mark.parametrize("settings", ALL_SETTINGS)
def test_generated_plan_has_no_issues(settings):
    assert build_degree_plan([], settings)["issues"] == []


@pytest.mark.parametrize("settings", ALL_SETTINGS)
def test_generated_plan_respects_prereqs_terms_and_limits(settings):
    result = build_degree_plan([], settings)
    done = set(result["ap_credit"])

    for semester in result["plan"]:
        season = semester["term"].split()[-1]
        for code in codes(semester):
            info = COURSES[code]
            assert season in info["terms"], f"{code} not offered in {semester['term']}"
            assert all(p in done for p in info["prereqs"]), f"{code} before its prereqs"
            assert code not in done, f"{code} scheduled twice"
        assert semester["units"] <= settings["maxUnits"]
        if season != "Summer":
            assert semester["units"] >= FULL_TIME_UNITS
        done.update(codes(semester))


def test_standard_plan_completes_the_degree():
    result = build_degree_plan([], {"timeline": 4, "maxUnits": 16})

    assert result["warnings"] == []
    assert result["total_units"] >= TOTAL_UNITS
    assert result["upper_eecs_units"] >= UPPER_EECS_UNITS
    planned = {c for s in result["plan"] for c in codes(s)}
    assert any(COURSES[c].get("design") for c in planned)


def test_every_semester_gets_courses():
    for timeline in (3, 3.5, 4):
        result = build_degree_plan([], {"timeline": timeline, "maxUnits": 16})
        assert len(result["plan"]) == int(timeline * 2)
        assert all(s["courses"] for s in result["plan"])


def test_reading_and_composition_deadlines():
    result = build_degree_plan([], {"timeline": 4, "maxUnits": 16})
    term_of = {c: s["term"] for s in result["plan"] for c in codes(s)}
    assert term_of["R1A"].startswith("Year 1")
    assert term_of["R1B"].startswith(("Year 1", "Year 2"))


def test_math54_comes_before_eleng_64_and_66():
    result = build_degree_plan([], {"timeline": 4, "maxUnits": 16})
    order = [c for s in result["plan"] for c in codes(s)]
    terms = {c: i for i, s in enumerate(result["plan"]) for c in codes(s)}
    assert terms["MATH54"] < terms["ELENG66"] and terms["MATH54"] < terms["ELENG64"], order


# ---------- terms ----------

def test_build_terms_with_summer():
    assert build_terms(3, summer=True) == [
        "Year 1 Fall", "Year 1 Spring", "Year 1 Summer",
        "Year 2 Fall", "Year 2 Spring", "Year 2 Summer",
        "Year 3 Fall", "Year 3 Spring",
    ]


def test_summers_start_empty():
    result = build_degree_plan([], {"timeline": 4, "maxUnits": 16, "summer": True})
    summers = [s for s in result["plan"] if s["term"].endswith("Summer")]
    assert len(summers) == 3
    assert all(s["courses"] == [] for s in summers)


# ---------- AP credit (College of Engineering chart) ----------

@pytest.mark.parametrize("scores, courses, units", [
    ({}, [], 0),
    ({"calcBC": 3}, ["MATH51"], 5.36),
    ({"calcBC": 4}, ["MATH51", "MATH52"], 5.36),
    ({"calcAB": 5, "calcBC": 5}, ["MATH51", "MATH52"], 5.36),   # calculus area capped at 5.36
    ({"physicsCMech": 4}, [], 2.68),                            # units only below a 5
    ({"physicsCMech": 5}, ["PHYS7A"], 2.68),
    ({"englishLang": 3}, [], 5.36),                             # a 3 only covers Entry Level Writing
    ({"englishLang": 4}, ["R1A"], 5.36),
    ({"biology": 3}, [], 0),                                    # needs a 4
    ({"chemistry": 3}, ["NATSCI"], 5.36),
    ({"precalc": 5}, [], 0),                                    # not on the chart
])
def test_ap_credit(scores, courses, units):
    assert ap_credit(scores) == (courses, units)


def test_ap_counts_for_at_most_two_hss_courses():
    courses, _ = ap_credit({"usHistory": 5, "psychology": 5, "latin": 5, "englishLang": 5})
    hss = [c for c in courses if COURSES[c]["category"] == "hss"]
    assert len(hss) == 2
    assert "R1A" in hss  # the specific R&C credit wins over generic breadth


def test_ap_units_count_toward_graduation():
    without = build_degree_plan([], {"timeline": 4, "maxUnits": 16})
    with_cs = build_degree_plan([], {"timeline": 4, "maxUnits": 16, "ap": {"csA": 5}})
    assert with_cs["ap_units"] == 5.36
    assert with_cs["total_units"] > without["total_units"]


# ---------- editing and review ----------

SETTINGS = {"timeline": 4, "maxUnits": 16}


def edited(result, changes, credited=()):
    schedule, applied, skipped = apply_changes(result["plan"], changes, credited)
    return [{"term": t, "courses": c} for t, c in schedule], applied, skipped


def messages(result):
    return [i["message"] for i in result["issues"]]


def test_review_flags_missing_prereqs_and_unit_limit():
    plan, _, _ = edited(build_degree_plan([], SETTINGS), [
        {"action": "move", "course": "CS189", "to_term": "Year 1 Fall"},
    ])
    result = review_plan(plan, SETTINGS)
    assert any("CS189 needs" in m for m in messages(result))
    assert any("over your 16-unit limit" in m for m in messages(result))


def test_review_flags_reading_and_composition_deadline():
    plan, _, _ = edited(build_degree_plan([], SETTINGS), [
        {"action": "move", "course": "R1A", "to_term": "Year 2 Fall"},
    ])
    assert any("R1A must be finished by the end of Year 1" in m for m in messages(review_plan(plan, SETTINGS)))


def test_review_flags_light_semester():
    plan, _, _ = edited(build_degree_plan([], SETTINGS), [
        {"action": "remove", "course": "CS61A"},
        {"action": "remove", "course": "MATH51"},
    ])
    assert any("below the 12-unit full-time minimum" in m for m in messages(review_plan(plan, SETTINGS)))


def test_review_warns_when_requirements_are_missing():
    plan, _, _ = edited(build_degree_plan([], SETTINGS), [
        {"action": "remove", "course": c} for c in ("CS162", "CS161", "CS186", "CS164", "CS169A", "R1A")
    ])
    warnings = " ".join(review_plan(plan, SETTINGS)["warnings"])
    assert "R1A" in warnings
    assert "design course" in warnings


def test_apply_changes_skips_bad_edits():
    settings = {**SETTINGS, "ap": {"calcBC": 5}}
    result = build_degree_plan([], settings)
    _, applied, skipped = edited(result, [
        {"action": "add", "course": "MATH51", "to_term": "Year 1 Fall"},   # AP credit
        {"action": "add", "course": "CS999", "to_term": "Year 1 Fall"},    # not a course
        {"action": "move", "course": "CS170", "to_term": "Summer"},        # not a term
        {"action": "move", "course": "cs 188", "to_term": "Year 4 Fall"},  # normalized code
    ], result["ap_credit"])

    assert applied == ["Moved CS188 → Year 4 Fall"]
    assert len(skipped) == 3


def test_review_flags_ap_duplicate():
    settings = {**SETTINGS, "ap": {"calcBC": 5}}
    plan = build_degree_plan([], settings)["plan"]
    plan[0]["courses"].append("MATH51")
    assert "MATH51 is already covered by your AP credit." in messages(review_plan(plan, settings))
