from collections import defaultdict
from math import ceil

from backend.curriculum import (
    AP_AREA_UNIT_CAP, AP_EXAMS, AP_MAX_HSS, COURSES, FOCUS_TRACKS, OFFERINGS_CHECKED, TOTAL_UNITS,
    UPPER_EECS_UNITS,
)

UPPER_HSS_COURSES = 2

FULL_TIME_UNITS = 12


def scheduling_passes(hss_per_term):
    """
    Categories to fill, in priority order:
    (category, max courses of that category in this pass, may go past the semester's target)
    """
    return [
        ("hss", hss_per_term, False),  # spread breadth courses evenly instead of piling them at the end
        ("core", None, False),
        ("ethics", None, False),
        ("elective", None, False),
        ("hss", None, False),          # extra breadth if there's still room
        ("ethics", None, True),        # otherwise squeeze the 1-unit ethics course into leftover room
    ]


# ---------- HELPERS ----------
def can_take(course, completed, season, year):
    info = COURSES[course]
    return (
        season in info["terms"]
        and year >= info.get("min_year", 1)
        and all(p in completed for p in info["prereqs"])
    )


def build_terms(timeline_years: float, summer=False):
    """
    Converts:
    4.0 -> 8 semesters
    3.5 -> 7 semesters
    3.0 -> 6 semesters
    With summer=True, a summer session follows every spring except the last term.
    """

    semesters = int(timeline_years * 2)

    base_terms = [
        "Year 1 Fall", "Year 1 Spring",
        "Year 2 Fall", "Year 2 Spring",
        "Year 3 Fall", "Year 3 Spring",
        "Year 4 Fall", "Year 4 Spring",
    ][:semesters]

    terms = []
    for i, term in enumerate(base_terms):
        terms.append(term)
        if summer and term.endswith("Spring") and i < len(base_terms) - 1:
            terms.append(term.replace("Spring", "Summer"))
    return terms


def term_year(term):
    return int(term.split()[1])


def term_season(term):
    return term.split()[-1]


def normalize_code(code):
    """"CS 61A" / "cs61a" -> "CS61A" """
    return code.replace(" ", "").upper()


def course_info(code):
    info = COURSES[code]
    return {
        "code": code,
        "title": info["title"],
        "units": info["units"],
        "category": info["category"],
    }


def catalog():
    return [
        {
            **course_info(code),
            "prereqs": info["prereqs"],
            "terms": info["terms"],
            "design": info.get("design", False),
            "upper_eecs": info.get("upper_eecs", False),
            "options": info.get("options", []),
        }
        for code, info in COURSES.items()
    ]


def focus_list():
    return {
        "tracks": [{"key": key, "label": track["label"]} for key, track in FOCUS_TRACKS.items()],
        "offerings_checked": OFFERINGS_CHECKED,
    }


def course_order(focus):
    """All course codes, with the focus track's electives first."""
    preferred = FOCUS_TRACKS.get(focus, FOCUS_TRACKS["balanced"])["electives"]
    return preferred + [c for c in COURSES if c not in preferred]


def ap_exam_list():
    return [
        {
            "key": key,
            "label": exam["label"],
            "group": exam["group"],
            "units": exam["units"],
            "min_score": exam.get("min_score", 3),
            "credit": [{"min_score": score, "courses": courses} for score, courses in exam["credit"]],
        }
        for key, exam in AP_EXAMS.items()
    ]


def parse_settings(settings):
    settings = settings or {}
    timeline = float(settings.get("timeline", 4))
    max_units = int(settings.get("maxUnits", 16))
    summer = bool(settings.get("summer", False))
    return timeline, max_units, summer, settings.get("ap", {})


def completed_courses_of(settings, extra=()):
    """Courses the student already took (e.g. community college, dual enrollment)."""
    codes = [normalize_code(c) for c in [*(settings or {}).get("completed", []), *extra]]
    return list(dict.fromkeys(c for c in codes if c in COURSES))


def ap_credit(scores):
    """
    AP exam scores ({exam: score}) -> (courses satisfied, units granted).
    Follows the College of Engineering chart: per-area unit caps, and at most
    AP_MAX_HSS of the H/SS courses (R&C included).
    """
    courses = []
    units = 0.0
    area_units = defaultdict(float)
    hss_used = 0

    # exams that grant a specific course go first, so a generic breadth credit never crowds out R1A
    def specific_first(exam):
        credit = AP_EXAMS.get(exam, {}).get("credit", [])
        return any(c == "HSS" for _, cs in credit for c in cs)

    for exam in sorted(scores, key=specific_first):
        info = AP_EXAMS.get(exam)
        score = int(scores[exam])
        if not info or score < info.get("min_score", 3):
            continue

        granted = info["units"]
        if "area" in info:
            granted = min(granted, AP_AREA_UNIT_CAP - area_units[info["area"]])
            area_units[info["area"]] += granted
        units += granted

        rows = [cs for min_score, cs in info["credit"] if score >= min_score]
        for course in (rows[-1] if rows else []):
            if course == "HSS":
                # AP exams are lower-division, so they never fill an upper-division H/SS slot
                course = next(
                    (c for c in COURSES if c.startswith("HSS") and not COURSES[c].get("upper_hss")
                     and c not in courses),
                    None,
                )
            if not course or course in courses:
                continue
            if COURSES[course]["category"] == "hss":
                if hss_used >= AP_MAX_HSS:
                    continue
                hss_used += 1
            courses.append(course)

    return courses, round(units, 2)


def plan_to_schedule(plan):
    """API plan (semesters with course objects) -> [(term, [codes])]"""
    return [
        (sem["term"], [c["code"] if isinstance(c, dict) else c for c in sem["courses"]])
        for sem in plan
    ]


# ---------- REVIEW ----------
def summarize(schedule, credited, ap_units, max_units, completed=()):
    """Turn [(term, [codes])] into the API response, checking every course along the way."""
    plan = []
    issues = []
    prior = set(credited) | set(completed)
    done = set(prior)   # finished before the current semester
    seen = set(prior)   # anywhere so far, to catch duplicates

    for term, codes in schedule:
        season = term_season(term)
        year = term_year(term)
        codes = [c for c in codes if c in COURSES]
        units = sum(COURSES[c]["units"] for c in codes)

        for code in codes:
            info = COURSES[code]
            if code in credited:
                issues.append({"term": term, "course": code, "message": f"{code} is already covered by your AP credit."})
            elif code in completed:
                issues.append({"term": term, "course": code, "message": f"You've already taken {code}."})
            elif code in seen:
                issues.append({"term": term, "course": code, "message": f"{code} is already in your plan."})
            elif season not in info["terms"]:
                issues.append({"term": term, "course": code, "message": f"{code} is only offered in {' & '.join(info['terms'])}."})
            else:
                missing = [p for p in info["prereqs"] if p not in done]
                if missing:
                    issues.append({"term": term, "course": code, "message": f"{code} needs {', '.join(missing)} first."})
                elif "deadline_year" in info and year > info["deadline_year"]:
                    issues.append({"term": term, "course": code, "message": f"{code} must be finished by the end of Year {info['deadline_year']}."})
            seen.add(code)

        if units > max_units:
            issues.append({"term": term, "course": None, "message": f"{units} units is over your {max_units}-unit limit."})
        elif units < FULL_TIME_UNITS and season != "Summer":
            issues.append({"term": term, "course": None, "message": f"{units} units is below the {FULL_TIME_UNITS}-unit full-time minimum."})

        done.update(codes)
        plan.append({
            "term": term,
            "courses": [course_info(c) for c in codes],
            "units": units
        })

    # courses taken here or before Berkeley (AP gives units instead of course units)
    taken = seen - set(credited)
    total_units = round(sum(COURSES[c]["units"] for c in taken) + ap_units, 2)
    upper_eecs = sum(COURSES[c]["units"] for c in taken if COURSES[c].get("upper_eecs"))

    warnings = []

    missing = [c for c in COURSES if COURSES[c]["category"] != "elective" and c not in seen]
    if missing:
        warnings.append(f"Required courses missing from your plan: {', '.join(missing)}.")
    if upper_eecs < UPPER_EECS_UNITS:
        warnings.append(f"Only {upper_eecs} of the {UPPER_EECS_UNITS} upper-division EECS units the major requires.")
    if not any(COURSES[c].get("design") for c in taken):
        design = [c for c in COURSES if COURSES[c].get("design")]
        warnings.append(f"No design course yet. The major requires one, e.g. {', '.join(design[:5])}.")
    if total_units < TOTAL_UNITS:
        warnings.append(
            f"This plan reaches {total_units:g} of the {TOTAL_UNITS} units needed to graduate. "
            "Try a higher unit limit or a longer timeline."
        )

    return {
        "plan": plan,
        "total_units": total_units,
        "ap_credit": list(credited),
        "ap_units": ap_units,
        "completed": list(completed),
        "upper_eecs_units": upper_eecs,
        "warnings": warnings,
        "issues": issues,
    }


def review_plan(plan, settings):
    """Re-check a plan the student (or the advisor) edited."""
    _, max_units, _, scores = parse_settings(settings)
    credited, ap_units = ap_credit(scores)
    completed = [c for c in completed_courses_of(settings) if c not in credited]
    return summarize(plan_to_schedule(plan), credited, ap_units, max_units, completed)


def apply_changes(plan, changes, credited=(), completed=()):
    """
    Apply advisor edits to a plan.
    changes: [{"action": "move" | "add" | "remove", "course": "CS70", "to_term": "Year 2 Fall"}]
    Returns (new schedule, descriptions of applied changes, descriptions of skipped changes).
    """
    schedule = [(term, list(codes)) for term, codes in plan_to_schedule(plan)]
    terms = [term for term, _ in schedule]
    applied, skipped = [], []

    for change in changes:
        code = normalize_code(change["course"])
        action = change["action"]
        to_term = change.get("to_term", "")

        if code not in COURSES:
            skipped.append(f"{change['course']} isn't in the course catalog")
            continue
        if code in credited:
            skipped.append(f"{code} is already covered by your AP credit")
            continue
        if code in completed:
            skipped.append(f"You've already taken {code}")
            continue
        if action in ("move", "add") and to_term not in terms:
            skipped.append(f"{code}: '{to_term}' isn't a semester in your plan")
            continue

        for _, codes in schedule:
            if code in codes:
                codes.remove(code)

        if action == "remove":
            applied.append(f"Removed {code}")
        else:
            schedule[terms.index(to_term)][1].append(code)
            applied.append(f"{'Moved' if action == 'move' else 'Added'} {code} → {to_term}")

    return schedule, applied, skipped


# ---------- MAIN ENGINE ----------
def build_degree_plan(completed_courses, settings=None):
    timeline, max_units, summer, scores = parse_settings(settings)
    credited, ap_units = ap_credit(scores)
    prior = [c for c in completed_courses_of(settings, completed_courses) if c not in credited]
    order = course_order((settings or {}).get("focus", "balanced"))

    completed = set(prior) | set(credited)
    units_done = ap_units + sum(COURSES[c]["units"] for c in prior)

    terms = build_terms(timeline, summer)
    # summers start empty; students (or the advisor) fill them by hand
    regular = [t for t in terms if term_season(t) != "Summer"]
    planned = {}

    for i, term in enumerate(regular):
        year = term_year(term)
        season = term_season(term)

        # spread the remaining units evenly over the remaining semesters
        terms_left = len(regular) - i
        target = ceil((TOTAL_UNITS - units_done) / terms_left)
        target = min(max_units, max(FULL_TIME_UNITS, target))

        hss_left = sum(1 for c in COURSES if COURSES[c]["category"] == "hss" and c not in completed)
        hss_per_term = ceil(hss_left / terms_left)

        semester_courses = []
        units = 0

        for category, limit, past_target in scheduling_passes(hss_per_term):
            added = 0
            for course in order:
                if (units >= target and not past_target) or (limit is not None and added >= limit):
                    break
                if (
                    COURSES[course]["category"] != category
                    or course in completed
                    or course in semester_courses
                    or not can_take(course, completed, season, year)
                ):
                    continue

                course_units = COURSES[course]["units"]

                # a small course shouldn't leave the semester unable to reach its target with 4-unit courses
                # (in the last semester a required course wins anyway, as long as full-time is still reachable)
                after = units + course_units
                reachable = after + 4 * ((max_units - after) // 4)
                strands = (
                    not past_target
                    and course_units < 4
                    and reachable < target
                    and not (i == len(regular) - 1 and reachable >= FULL_TIME_UNITS)
                )

                if units + course_units <= max_units and not strands:
                    semester_courses.append(course)
                    units += course_units
                    added += 1

        # mark completed
        completed.update(semester_courses)
        units_done += units
        planned[term] = semester_courses

    schedule = [(term, planned.get(term, [])) for term in terms]
    return summarize(schedule, credited, ap_units, max_units, prior)
