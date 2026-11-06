import type { Semester } from "@/lib/api";
import { siteUrl } from "@/lib/suite";

// Courses that point toward a kind of internship, and the Internship Finder search for it
const TOPICS: { label: string; search: Record<string, string>; courses: string[] }[] = [
  { label: "AI and data", search: { field: "AI & Data" }, courses: ["CS189", "CS182", "CS188", "DATA100", "EECS127", "EECS126"] },
  { label: "Software", search: { field: "Software" }, courses: ["CS162", "CS164", "CS169A", "CS186", "CS168"] },
  { label: "Hardware", search: { field: "Hardware" }, courses: ["EECS151", "CS152", "EECS149", "ELENG105", "ELENG120"] },
  { label: "Security", search: { q: "security" }, courses: ["CS161"] },
  { label: "Robotics", search: { q: "robotics" }, courses: ["EECS106A"] },
  { label: "Graphics", search: { q: "graphics" }, courses: ["CS184"] },
  { label: "Quant", search: { field: "Quant" }, courses: ["CS170", "CS172", "CS174"] },
  { label: "Design", search: { field: "Design" }, courses: ["CS160"] },
];

export interface InternshipIdea {
  label: string;
  url: string;
  because: string[];  // the planned courses behind it
}

/** Kinds of internship this plan points toward, the ones with the most courses behind them first. */
export function internshipIdeas(plan: Semester[], limit = 4): InternshipIdea[] {
  const planned = new Set(plan.flatMap((s) => s.courses.map((c) => c.code)));
  return TOPICS
    .map(({ label, search, courses }) => ({
      label,
      url: `${siteUrl("internships")}/?${new URLSearchParams(search)}`,
      because: courses.filter((c) => planned.has(c)),
    }))
    .filter((idea) => idea.because.length > 0)
    .sort((a, b) => b.because.length - a.because.length)
    .slice(0, limit);
}
