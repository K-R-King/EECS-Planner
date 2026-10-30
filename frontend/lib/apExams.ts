// Every AP exam, grouped by College Board subject area.
// `credit` describes what a 4-5 earns in this plan (see backend/curriculum.py AP_CREDIT).

export interface ApExam {
  key: string;
  label: string;
  credit: string;
}

export const AP_GROUPS: { name: string; exams: ApExam[] }[] = [
  {
    name: "Math & Computer Science",
    exams: [
      { key: "calcAB", label: "Calculus AB", credit: "Math 1A" },
      { key: "calcBC", label: "Calculus BC", credit: "Math 1A + 1B" },
      { key: "precalc", label: "Precalculus", credit: "Units" },
      { key: "statistics", label: "Statistics", credit: "Units" },
      { key: "csA", label: "Computer Science A", credit: "Units" },
      { key: "csPrinciples", label: "CS Principles", credit: "Units" },
    ],
  },
  {
    name: "Sciences",
    exams: [
      { key: "physicsCMech", label: "Physics C: Mechanics", credit: "Physics 7A" },
      { key: "physicsCEM", label: "Physics C: E&M", credit: "Units" },
      { key: "physics1", label: "Physics 1", credit: "Units" },
      { key: "physics2", label: "Physics 2", credit: "Units" },
      { key: "chemistry", label: "Chemistry", credit: "Units" },
      { key: "biology", label: "Biology", credit: "Units" },
      { key: "envSci", label: "Environmental Science", credit: "Units" },
    ],
  },
  {
    name: "English",
    exams: [
      { key: "englishLang", label: "English Language", credit: "R1A" },
      { key: "englishLit", label: "English Literature", credit: "R1A" },
    ],
  },
  {
    name: "History & Social Sciences",
    exams: [
      { key: "usHistory", label: "US History", credit: "Breadth" },
      { key: "worldHistory", label: "World History: Modern", credit: "Breadth" },
      { key: "euroHistory", label: "European History", credit: "Breadth" },
      { key: "usGov", label: "US Government & Politics", credit: "Breadth" },
      { key: "compGov", label: "Comparative Government", credit: "Breadth" },
      { key: "macroecon", label: "Macroeconomics", credit: "Breadth" },
      { key: "microecon", label: "Microeconomics", credit: "Breadth" },
      { key: "psychology", label: "Psychology", credit: "Breadth" },
      { key: "humanGeo", label: "Human Geography", credit: "Breadth" },
      { key: "africanAmerican", label: "African American Studies", credit: "Breadth" },
    ],
  },
  {
    name: "Arts",
    exams: [
      { key: "artHistory", label: "Art History", credit: "Breadth" },
      { key: "musicTheory", label: "Music Theory", credit: "Breadth" },
      { key: "art2D", label: "2-D Art & Design", credit: "Units" },
      { key: "art3D", label: "3-D Art & Design", credit: "Units" },
      { key: "drawing", label: "Drawing", credit: "Units" },
    ],
  },
  {
    name: "World Languages",
    exams: [
      { key: "chinese", label: "Chinese", credit: "Breadth" },
      { key: "french", label: "French", credit: "Breadth" },
      { key: "german", label: "German", credit: "Breadth" },
      { key: "italian", label: "Italian", credit: "Breadth" },
      { key: "japanese", label: "Japanese", credit: "Breadth" },
      { key: "latin", label: "Latin", credit: "Breadth" },
      { key: "spanishLang", label: "Spanish Language", credit: "Breadth" },
      { key: "spanishLit", label: "Spanish Literature", credit: "Breadth" },
    ],
  },
  {
    name: "AP Capstone",
    exams: [
      { key: "seminar", label: "Seminar", credit: "Units" },
      { key: "research", label: "Research", credit: "Units" },
    ],
  },
];

export const AP_EXAM_COUNT = AP_GROUPS.reduce((sum, g) => sum + g.exams.length, 0);
