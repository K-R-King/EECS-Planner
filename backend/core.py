from math import ceil

from backend.curriculum import AP_CREDIT, COURSES, TOTAL_UNITS

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


def build_terms(timeline_years: float):
    """
    Converts:
    4.0 -> 8 semesters
    3.5 -> 7 semesters
    3.0 -> 6 semesters
    """

    semesters = int(timeline_years * 2)

    base_terms = [
        "Year 1 Fall", "Year 1 Spring",
        "Year 2 Fall", "Year 2 Spring",
        "Year 3 Fall", "Year 3 Spring",
        "Year 4 Fall", "Year 4 Spring",
    ]

    return base_terms[:semesters]


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
        {**course_info(code), "prereqs": info["prereqs"], "terms": info["terms"]}
        for code, info in COURSES.items()
    ]


def parse_settings(settings):
    settings = settings or {}
    timeline = float(settings.get("timeline", 4))
    max_units = int(settings.get("maxUnits", 16))
    return timeline, max_units, ap_courses(settings.get("ap", []))


def ap_courses(exams):
    """Courses satisfied by the given AP exams, in order, without duplicates."""
    credited = []
    for exam in exams:
        for course in AP_CREDIT.get(exam, []):
            if course == "HSS":
                course = next(
                    (c for c in COURSES if COURSES[c]["category"] == "hss"
                     and c.startswith("HSS") and c not in credited),
                    None,
                )
            if course and course not in credited:
                credited.append(course)
    return credited


def plan_to_schedule(plan):
    """API plan (semesters with course objects) -> [(term, [codes])]"""
    return [
        (sem["term"], [c["code"] if isinstance(c, dict) else c for c in sem["courses"]])
        for sem in plan
    ]


# ---------- REVIEW ----------
def summarize(schedule, ap_credit, max_units):
    """Turn [(term, [codes])] into the API response, checking every course along the way."""
    plan = []
    issues = []
    done = set(ap_credit)   # finished before the current semester
    seen = set(ap_credit)   # anywhere so far, to catch duplicates

    for term, codes in schedule:
        season = term.split()[-1]
        codes = [c for c in codes if c in COURSES]
        units = sum(COURSES[c]["units"] for c in codes)

        for code in codes:
            info = COURSES[code]
            if code in ap_credit:
                issues.append({"term": term, "course": code, "message": f"{code} is already covered by your AP credit."})
            elif code in seen:
                issues.append({"term": term, "course": code, "message": f"{code} is already in your plan."})
            elif season not in info["terms"]:
                issues.append({"term": term, "course": code, "message": f"{code} is only offered in {' & '.join(info['terms'])}."})
            else:
                missing = [p for p in info["prereqs"] if p not in done]
                if missing:
                    issues.append({"term": term, "course": code, "message": f"{code} needs {', '.join(missing)} first."})
            seen.add(code)

        if units > max_units:
            issues.append({"term": term, "course": None, "message": f"{units} units is over your {max_units}-unit limit."})
        elif units < FULL_TIME_UNITS:
            issues.append({"term": term, "course": None, "message": f"{units} units is below the {FULL_TIME_UNITS}-unit full-time minimum."})

        done.update(codes)
        plan.append({
            "term": term,
            "courses": [course_info(c) for c in codes],
            "units": units
        })

    total_units = sum(COURSES[c]["units"] for c in seen if c in COURSES)

    warnings = []

    missing = [c for c in COURSES if COURSES[c]["category"] != "elective" and c not in seen]
    if missing:
        warnings.append(f"Required courses missing from your plan: {', '.join(missing)}.")
    if total_units < TOTAL_UNITS:
        warnings.append(
            f"This plan reaches {total_units} of the {TOTAL_UNITS} units needed to graduate. "
            "Try a higher unit limit or a longer timeline."
        )

    return {
        "plan": plan,
        "total_units": total_units,
        "ap_credit": ap_credit,
        "warnings": warnings,
        "issues": issues,
    }


def review_plan(plan, settings):
    """Re-check a plan the student (or the advisor) edited."""
    _, max_units, ap_credit = parse_settings(settings)
    return summarize(plan_to_schedule(plan), ap_credit, max_units)


def apply_changes(plan, changes, ap_credit=()):
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
        if code in ap_credit:
            skipped.append(f"{code} is already covered by your AP credit")
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
    timeline, max_units, ap_credit = parse_settings(settings)

    completed = set(completed_courses) | set(ap_credit)
    units_done = sum(COURSES[c]["units"] for c in completed if c in COURSES)
    terms = build_terms(timeline)
    schedule = []

    for i, term in enumerate(terms):
        year = i // 2 + 1
        season = term.split()[-1]  # "Year 1 Fall" -> "Fall"

        # spread the remaining units evenly over the remaining semesters
        terms_left = len(terms) - i
        target = ceil((TOTAL_UNITS - units_done) / terms_left)
        target = min(max_units, max(FULL_TIME_UNITS, target))

        hss_left = sum(1 for c in COURSES if COURSES[c]["category"] == "hss" and c not in completed)
        hss_per_term = ceil(hss_left / terms_left)

        semester_courses = []
        units = 0

        for category, limit, past_target in scheduling_passes(hss_per_term):
            added = 0
            for course in COURSES:
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
                    and not (i == len(terms) - 1 and reachable >= FULL_TIME_UNITS)
                )

                if units + course_units <= max_units and not strands:
                    semester_courses.append(course)
                    units += course_units
                    added += 1

        # mark completed
        completed.update(semester_courses)
        units_done += units
        schedule.append((term, semester_courses))

    return summarize(schedule, ap_credit, max_units)
