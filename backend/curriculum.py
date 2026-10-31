# UC Berkeley EECS (College of Engineering) degree requirements, 2026-27 entering students.
#
# Sources (checked 2026-10-31):
#   Major:  https://engineering.berkeley.edu/students/undergraduate-guide/degree-requirements/major-programs/electrical-engineering-computer-sciences/
#   Lower division:  https://eecs.berkeley.edu/resources/undergrads/eecs-2/degree-reqs-lowerdiv-2/
#   AP credit:  https://engineering.berkeley.edu/students/undergraduate-guide/exams/
# Prerequisites for upper-division electives are simplified; confirm them in the course catalog.
#
# Order matters: within each category, courses listed first get scheduled first.
#
# category:
#   core     - required lower-division courses
#   hss      - Reading & Composition + Humanities/Social Sciences breadth (6 courses)
#   ethics   - engineering ethics requirement
#   elective - upper-division technical electives
#
# Optional fields:
#   upper_eecs     - counts toward the 20 upper-division EECS units
#   design         - satisfies the major design requirement
#   deadline_year  - must be finished by the end of this year (Reading & Composition)
#   min_year       - planner heuristic: don't auto-schedule before this year

TOTAL_UNITS = 120
UPPER_EECS_UNITS = 20

BOTH = ["Fall", "Spring"]
ALL = ["Fall", "Spring", "Summer"]  # commonly offered in summer too (not verified per year)

COURSES = {
    # ---------- CORE (lower division) ----------
    "MATH51":  {"title": "Calculus I (formerly Math 1A)",      "units": 4, "prereqs": [],                     "terms": ALL,  "category": "core"},
    "CS61A":   {"title": "Structure & Interpretation of Programs", "units": 4, "prereqs": [],                "terms": ALL,  "category": "core"},
    "NATSCI":  {"title": "Natural Science Elective (e.g. Chem 1A, Bio 1A)", "units": 4, "prereqs": [],       "terms": BOTH, "category": "core"},
    "MATH52":  {"title": "Calculus II (formerly Math 1B)",     "units": 4, "prereqs": ["MATH51"],             "terms": ALL,  "category": "core"},
    "CS61B":   {"title": "Data Structures",                    "units": 4, "prereqs": ["CS61A"],              "terms": ALL,  "category": "core"},
    "MATH54":  {"title": "Linear Algebra & Differential Equations", "units": 4, "prereqs": ["MATH52"],       "terms": ALL,  "category": "core"},
    "CS61C":   {"title": "Machine Structures",                 "units": 4, "prereqs": ["CS61B"],              "terms": ALL,  "category": "core"},
    "PHYS7A":  {"title": "Physics: Mechanics",                 "units": 4, "prereqs": ["MATH51"],             "terms": ALL,  "category": "core"},
    "MATH53":  {"title": "Multivariable Calculus",             "units": 4, "prereqs": ["MATH52"],             "terms": ALL,  "category": "core"},
    "CS70":    {"title": "Discrete Math & Probability",        "units": 4, "prereqs": ["CS61A"],              "terms": ALL,  "category": "core"},
    "PHYS7B":  {"title": "Physics: Heat, Electricity & Magnetism", "units": 4, "prereqs": ["PHYS7A", "MATH52"], "terms": ALL, "category": "core"},
    # Math 54 must come first (EECS department)
    "ELENG66": {"title": "Signals, Systems & Information (formerly EECS 16A)", "units": 4, "prereqs": ["MATH54"], "terms": BOTH, "category": "core"},
    "ELENG64": {"title": "Circuits & Devices (formerly EECS 16B)", "units": 4, "prereqs": ["MATH54"],         "terms": BOTH, "category": "core"},

    # ---------- READING & COMPOSITION + H/SS BREADTH ----------
    "R1A":  {"title": "Reading & Composition A",            "units": 4, "prereqs": [],      "terms": ALL, "category": "hss", "deadline_year": 1},
    "R1B":  {"title": "Reading & Composition B",            "units": 4, "prereqs": ["R1A"], "terms": ALL, "category": "hss", "deadline_year": 2},
    "HSS1": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": ALL, "category": "hss"},
    "HSS2": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": ALL, "category": "hss"},
    "HSS3": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": ALL, "category": "hss", "min_year": 2},
    "HSS4": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": ALL, "category": "hss", "min_year": 2},

    # ---------- ETHICS ----------
    "CS195": {"title": "Social Implications of Computer Technology", "units": 1, "prereqs": [], "terms": BOTH, "category": "ethics", "min_year": 2},

    # ---------- UPPER-DIVISION TECHNICAL ELECTIVES ----------
    "CS170":    {"title": "Efficient Algorithms",                 "units": 4, "prereqs": ["CS61B", "CS70"],            "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS188":    {"title": "Artificial Intelligence",              "units": 4, "prereqs": ["CS61B", "CS70"],            "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS162":    {"title": "Operating Systems",                    "units": 4, "prereqs": ["CS61B", "CS61C"],           "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "CS189":    {"title": "Machine Learning",                     "units": 4, "prereqs": ["CS70", "MATH53", "MATH54"], "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS161":    {"title": "Computer Security",                    "units": 4, "prereqs": ["CS61C", "CS70"],            "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "CS186":    {"title": "Database Systems",                     "units": 4, "prereqs": ["CS61B", "CS61C"],           "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "EECS127":  {"title": "Optimization Models",                  "units": 4, "prereqs": ["MATH54"],                   "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS164":    {"title": "Programming Languages & Compilers",    "units": 4, "prereqs": ["CS61B", "CS61C"],           "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "CS168":    {"title": "Internet Architecture & Protocols",    "units": 4, "prereqs": ["CS61B", "CS61C"],           "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS169A":   {"title": "Software Engineering",                 "units": 4, "prereqs": ["CS61B", "CS61C"],           "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "EECS126":  {"title": "Probability & Random Processes",       "units": 4, "prereqs": ["CS70"],                     "terms": BOTH, "category": "elective", "upper_eecs": True},
    "EECS151":  {"title": "Digital Design + Lab (151 + 151LA)",   "units": 5, "prereqs": ["CS61C", "ELENG64"],         "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "ELENG120": {"title": "Signals & Systems",                    "units": 4, "prereqs": ["ELENG66", "MATH54"],        "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS184":    {"title": "Computer Graphics",                    "units": 4, "prereqs": ["CS61B", "MATH54"],          "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "CS160":    {"title": "User Interface Design",                "units": 4, "prereqs": ["CS61B"],                    "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},

    # extra electives: not needed by the auto-planner, but students can add them
    "CS152":    {"title": "Computer Architecture",                "units": 4, "prereqs": ["CS61C"],                    "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS172":    {"title": "Computability & Complexity",           "units": 4, "prereqs": ["CS170"],                    "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS174":    {"title": "Combinatorics & Discrete Probability", "units": 4, "prereqs": ["CS170"],                    "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS176":    {"title": "Algorithms for Computational Biology", "units": 4, "prereqs": ["CS61B", "CS70"],            "terms": BOTH, "category": "elective", "upper_eecs": True},
    "CS182":    {"title": "Deep Neural Networks",                 "units": 4, "prereqs": ["CS189"],                    "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "CS191":    {"title": "Quantum Information Science",          "units": 4, "prereqs": ["CS70", "MATH54"],           "terms": BOTH, "category": "elective", "upper_eecs": True},
    "EECS106A": {"title": "Robotic Manipulation & Interaction",   "units": 4, "prereqs": ["ELENG66", "ELENG64"],       "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "EECS149":  {"title": "Embedded Systems",                     "units": 4, "prereqs": ["CS61C", "ELENG64"],         "terms": BOTH, "category": "elective", "upper_eecs": True, "design": True},
    "ELENG105": {"title": "Microelectronic Devices & Circuits",   "units": 4, "prereqs": ["ELENG64"],                  "terms": BOTH, "category": "elective", "upper_eecs": True},
    # cross-listed data science course; not counted toward the 20 upper-division EECS units here
    "DATA100":  {"title": "Principles & Techniques of Data Science", "units": 4, "prereqs": ["CS61A", "MATH54"],       "terms": BOTH, "category": "elective"},
}


# ---------- AP CREDIT (College of Engineering chart) ----------
# units:      units granted (score >= min_score, default 3)
# area:       exams in the same area share a 5.36-unit cap
# credit:     [(minimum score, courses satisfied)] - the highest matching row wins
#             "HSS" = one lower-division Humanities/Social Sciences course
# AP can satisfy at most 2 of the 6 H/SS courses (R&C included).

AP_AREA_UNIT_CAP = 5.36
AP_MAX_HSS = 2

HSS_CREDIT = [(3, ["HSS"])]

AP_EXAMS = {
    # Math & Computer Science
    "calcAB":       {"label": "Calculus AB",              "group": "Math & Computer Science", "units": 2.68, "area": "calculus", "credit": [(3, ["MATH51"])]},
    "calcBC":       {"label": "Calculus BC",              "group": "Math & Computer Science", "units": 5.36, "area": "calculus", "credit": [(3, ["MATH51"]), (4, ["MATH51", "MATH52"])]},
    "statistics":   {"label": "Statistics",               "group": "Math & Computer Science", "units": 2.68, "credit": []},
    "csA":          {"label": "Computer Science A",       "group": "Math & Computer Science", "units": 5.36, "credit": []},
    "csPrinciples": {"label": "CS Principles",            "group": "Math & Computer Science", "units": 5.36, "credit": []},
    "precalc":      {"label": "Precalculus",              "group": "Math & Computer Science", "units": 0,    "credit": []},  # not on the chart

    # Sciences
    "physicsCMech": {"label": "Physics C: Mechanics",     "group": "Sciences", "units": 2.68, "area": "physics", "credit": [(5, ["PHYS7A"])]},
    "physicsCEM":   {"label": "Physics C: E&M",           "group": "Sciences", "units": 2.68, "area": "physics", "credit": []},
    "physics1":     {"label": "Physics 1",                "group": "Sciences", "units": 5.36, "area": "physics", "credit": []},
    "physics2":     {"label": "Physics 2",                "group": "Sciences", "units": 5.36, "area": "physics", "credit": []},
    "chemistry":    {"label": "Chemistry",                "group": "Sciences", "units": 5.36, "credit": [(3, ["NATSCI"])]},  # = Chem 1A + 1AL
    "biology":      {"label": "Biology",                  "group": "Sciences", "units": 5.36, "min_score": 4, "credit": [(4, ["NATSCI"])]},  # = Bio 1A + 1AL
    "envSci":       {"label": "Environmental Science",    "group": "Sciences", "units": 2.68, "credit": []},

    # English (a 3 only satisfies the Entry Level Writing requirement)
    "englishLang":  {"label": "English Language",         "group": "English", "units": 5.36, "area": "english", "credit": [(4, ["R1A"])]},
    "englishLit":   {"label": "English Literature",       "group": "English", "units": 5.36, "area": "english", "credit": [(4, ["R1A"])]},

    # History & Social Sciences
    "usHistory":       {"label": "US History",               "group": "History & Social Sciences", "units": 5.36, "credit": HSS_CREDIT},
    "worldHistory":    {"label": "World History: Modern",    "group": "History & Social Sciences", "units": 5.36, "credit": HSS_CREDIT},
    "euroHistory":     {"label": "European History",         "group": "History & Social Sciences", "units": 5.36, "credit": HSS_CREDIT},
    "usGov":           {"label": "US Government & Politics", "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "compGov":         {"label": "Comparative Government",   "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "macroecon":       {"label": "Macroeconomics",           "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "microecon":       {"label": "Microeconomics",           "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "psychology":      {"label": "Psychology",               "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "humanGeo":        {"label": "Human Geography",          "group": "History & Social Sciences", "units": 2.68, "credit": HSS_CREDIT},
    "africanAmerican": {"label": "African American Studies", "group": "History & Social Sciences", "units": 5.36, "credit": HSS_CREDIT},

    # Arts
    "artHistory":   {"label": "Art History",              "group": "Arts", "units": 5.36, "area": "art", "credit": HSS_CREDIT},
    "art2D":        {"label": "2-D Art & Design",         "group": "Arts", "units": 5.36, "area": "art", "credit": HSS_CREDIT},
    "art3D":        {"label": "3-D Art & Design",         "group": "Arts", "units": 5.36, "area": "art", "credit": HSS_CREDIT},
    "drawing":      {"label": "Drawing",                  "group": "Arts", "units": 5.36, "area": "art", "credit": HSS_CREDIT},
    "musicTheory":  {"label": "Music Theory",             "group": "Arts", "units": 5.36, "credit": HSS_CREDIT},

    # World Languages & Cultures
    "chinese":      {"label": "Chinese",                  "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "french":       {"label": "French",                   "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "german":       {"label": "German",                   "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "italian":      {"label": "Italian",                  "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "japanese":     {"label": "Japanese",                 "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "latin":        {"label": "Latin",                    "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "spanishLang":  {"label": "Spanish Language",         "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},
    "spanishLit":   {"label": "Spanish Literature",       "group": "World Languages", "units": 5.36, "credit": HSS_CREDIT},

    # AP Capstone (not on the chart)
    "seminar":      {"label": "Seminar",                  "group": "AP Capstone", "units": 0, "credit": []},
    "research":     {"label": "Research",                 "group": "AP Capstone", "units": 0, "credit": []},
}
