import type { ApExam } from "@/lib/api";

// "MATH51" -> "Math 51", "HSS" -> "Breadth"
function courseName(code: string): string {
  if (code === "HSS") return "Breadth";
  if (code === "NATSCI") return "Nat. Sci.";
  return code
    .replace(/^MATH/, "Math")
    .replace(/^PHYS/, "Physics")
    .replace(/^([A-Za-z]+)(\d)/, "$1 $2");
}

/** What an exam earns at a given score, e.g. "Math 51 + Math 52" or "5.36 units". */
export function creditFor(exam: ApExam, score: number): string {
  if (score < exam.min_score || exam.units === 0) return "No credit";
  const row = exam.credit.filter((r) => score >= r.min_score).at(-1);
  return row ? row.courses.map(courseName).join(" + ") : `${exam.units} units`;
}

/** Exams grouped by subject, keeping the backend's order. */
export function groupExams(exams: ApExam[]): { name: string; exams: ApExam[] }[] {
  const groups: { name: string; exams: ApExam[] }[] = [];
  for (const exam of exams) {
    const group = groups.find((g) => g.name === exam.group);
    if (group) group.exams.push(exam);
    else groups.push({ name: exam.group, exams: [exam] });
  }
  return groups;
}
