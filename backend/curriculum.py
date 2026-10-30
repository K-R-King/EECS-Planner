# UC Berkeley EECS (College of Engineering) degree requirements.
# Order matters: within each category, courses listed first get scheduled first.
#
# category:
#   core     - required lower-division courses
#   hss      - Reading & Composition + Humanities/Social Sciences breadth
#   ethics   - engineering ethics requirement
#   elective - upper-division technical electives
#
# min_year (optional) - earliest year a course should be scheduled

TOTAL_UNITS = 120

BOTH = ["Fall", "Spring"]

COURSES = {
    # ---------- CORE (lower division) ----------
    "MATH1A":  {"title": "Calculus",                          "units": 4, "prereqs": [],                    "terms": BOTH, "category": "core"},
    "CS61A":   {"title": "Structure & Interpretation of Programs", "units": 4, "prereqs": [],               "terms": BOTH, "category": "core"},
    "EECS16A": {"title": "Designing Information Devices I",   "units": 4, "prereqs": [],                    "terms": BOTH, "category": "core"},
    "MATH1B":  {"title": "Calculus II",                       "units": 4, "prereqs": ["MATH1A"],            "terms": BOTH, "category": "core"},
    "CS61B":   {"title": "Data Structures",                   "units": 4, "prereqs": ["CS61A"],             "terms": BOTH, "category": "core"},
    "CS70":    {"title": "Discrete Math & Probability",       "units": 4, "prereqs": ["CS61A"],             "terms": BOTH, "category": "core"},
    "EECS16B": {"title": "Designing Information Devices II",  "units": 4, "prereqs": ["EECS16A"],           "terms": BOTH, "category": "core"},
    "CS61C":   {"title": "Machine Structures",                "units": 4, "prereqs": ["CS61B"],             "terms": BOTH, "category": "core"},
    "MATH53":  {"title": "Multivariable Calculus",            "units": 4, "prereqs": ["MATH1B"],            "terms": BOTH, "category": "core"},
    "MATH54":  {"title": "Linear Algebra & Differential Equations", "units": 4, "prereqs": ["MATH1B"],      "terms": BOTH, "category": "core"},
    "PHYS7A":  {"title": "Physics: Mechanics",                "units": 4, "prereqs": ["MATH1A"],            "terms": BOTH, "category": "core"},
    "PHYS7B":  {"title": "Physics: Heat, Electricity & Magnetism", "units": 4, "prereqs": ["PHYS7A", "MATH1B"], "terms": BOTH, "category": "core"},

    # ---------- READING & COMPOSITION + H/SS BREADTH ----------
    "R1A":  {"title": "Reading & Composition A",           "units": 4, "prereqs": [],      "terms": BOTH, "category": "hss"},
    "R1B":  {"title": "Reading & Composition B",           "units": 4, "prereqs": ["R1A"], "terms": BOTH, "category": "hss"},
    "HSS1": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": BOTH, "category": "hss"},
    "HSS2": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": BOTH, "category": "hss"},
    "HSS3": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": BOTH, "category": "hss", "min_year": 2},
    "HSS4": {"title": "Humanities/Social Sciences Breadth", "units": 4, "prereqs": [],      "terms": BOTH, "category": "hss", "min_year": 2},

    # ---------- ETHICS ----------
    "CS195": {"title": "Social Implications of Computer Technology", "units": 1, "prereqs": [], "terms": BOTH, "category": "ethics", "min_year": 2},

    # ---------- UPPER-DIVISION TECHNICAL ELECTIVES ----------
    "CS170":   {"title": "Efficient Algorithms",                "units": 4, "prereqs": ["CS61B", "CS70"],           "terms": BOTH,       "category": "elective"},
    "CS188":   {"title": "Artificial Intelligence",             "units": 4, "prereqs": ["CS61B", "CS70"],           "terms": BOTH,       "category": "elective"},
    "CS162":   {"title": "Operating Systems",                   "units": 4, "prereqs": ["CS61B", "CS61C"],          "terms": BOTH,       "category": "elective"},
    "CS189":   {"title": "Machine Learning",                    "units": 4, "prereqs": ["CS70", "MATH53", "MATH54"], "terms": BOTH,      "category": "elective"},
    "CS161":   {"title": "Computer Security",                   "units": 4, "prereqs": ["CS61C", "CS70"],           "terms": BOTH,       "category": "elective"},
    "CS186":   {"title": "Database Systems",                    "units": 4, "prereqs": ["CS61B", "CS61C"],          "terms": BOTH,       "category": "elective"},
    "EECS127": {"title": "Optimization Models",                 "units": 4, "prereqs": ["MATH54"],                  "terms": BOTH,       "category": "elective"},
    "CS164":   {"title": "Programming Languages & Compilers",   "units": 4, "prereqs": ["CS61B", "CS61C"],          "terms": BOTH,       "category": "elective"},
    "CS168":   {"title": "Internet Architecture & Protocols",   "units": 4, "prereqs": ["CS61B", "CS61C"],          "terms": BOTH,       "category": "elective"},
    "CS169A":  {"title": "Software Engineering",                "units": 4, "prereqs": ["CS61B", "CS61C"],          "terms": BOTH,       "category": "elective"},
    "EECS126": {"title": "Probability & Random Processes",      "units": 4, "prereqs": ["CS70"],                    "terms": BOTH,       "category": "elective"},
    "EECS151": {"title": "Digital Design + Lab",                "units": 5, "prereqs": ["CS61C", "EECS16B"],        "terms": BOTH,       "category": "elective"},
    "EE120":   {"title": "Signals & Systems",                   "units": 4, "prereqs": ["EECS16B", "MATH54"],       "terms": BOTH,       "category": "elective"},
    "CS184":   {"title": "Computer Graphics",                   "units": 4, "prereqs": ["CS61B", "MATH54"],         "terms": ["Spring"], "category": "elective"},
    "CS160":   {"title": "User Interface Design",               "units": 4, "prereqs": ["CS61B"],                   "terms": BOTH,       "category": "elective"},
}

# AP exams (score 4-5) -> Berkeley requirements they satisfy.
# "HSS" fills the next open Humanities/Social Sciences breadth slot.
# An empty list means the exam earns units only, not a course in this plan.
AP_CREDIT = {
    # Math & Computer Science
    "calcAB":       ["MATH1A"],
    "calcBC":       ["MATH1A", "MATH1B"],
    "precalc":      [],
    "statistics":   [],
    "csA":          [],
    "csPrinciples": [],

    # Sciences
    "physicsCMech": ["PHYS7A"],
    "physicsCEM":   [],
    "physics1":     [],
    "physics2":     [],
    "chemistry":    [],
    "biology":      [],
    "envSci":       [],

    # English
    "englishLang":  ["R1A"],
    "englishLit":   ["R1A"],

    # History & Social Sciences
    "usHistory":       ["HSS"],
    "worldHistory":    ["HSS"],
    "euroHistory":     ["HSS"],
    "usGov":           ["HSS"],
    "compGov":         ["HSS"],
    "macroecon":       ["HSS"],
    "microecon":       ["HSS"],
    "psychology":      ["HSS"],
    "humanGeo":        ["HSS"],
    "africanAmerican": ["HSS"],

    # Arts
    "artHistory":   ["HSS"],
    "musicTheory":  ["HSS"],
    "art2D":        [],
    "art3D":        [],
    "drawing":      [],

    # World Languages & Cultures
    "chinese":      ["HSS"],
    "french":       ["HSS"],
    "german":       ["HSS"],
    "italian":      ["HSS"],
    "japanese":     ["HSS"],
    "latin":        ["HSS"],
    "spanishLang":  ["HSS"],
    "spanishLit":   ["HSS"],

    # AP Capstone
    "seminar":      [],
    "research":     [],
}
