const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type Category = "core" | "hss" | "ethics" | "elective";

export interface Course {
  code: string;
  title: string;
  units: number;
  category: Category;
}

export interface Semester {
  term: string;
  courses: Course[];
  units: number;
}

export interface PlanResult {
  plan: Semester[];
  total_units: number;
  ap_credit: string[];
  warnings: string[];
}

export interface PlannerSettings {
  timeline: number;
  maxUnits: number;
  ap: string[];  // keys from lib/apExams.ts
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }

  return res.json();
}

export async function generatePlan(settings: PlannerSettings): Promise<PlanResult> {
  // incoming students have no completed courses
  return post<PlanResult>("/generate-plan", {
    completed_courses: [],
    settings,
  });
}

export async function askAdvisor(plan: Semester[], question: string): Promise<string> {
  const data = await post<{ answer: string }>("/advisor", { plan, question });
  return data.answer;
}
