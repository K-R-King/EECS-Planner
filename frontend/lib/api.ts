const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export interface Semester {
  term: string;
  courses: string[];
  units: number;
}

export interface PlannerSettings {
  timeline: number;
  maxUnits: number;
  apCS: boolean;
  apCalcBC: boolean;
  apPhysicsC: boolean;
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

export async function generatePlan(settings: PlannerSettings): Promise<Semester[]> {
  // incoming students have no completed courses
  const data = await post<{ plan: Semester[] }>("/generate-plan", {
    completed_courses: [],
    settings,
  });
  return data.plan;
}

export async function askAdvisor(plan: Semester[], question: string): Promise<string> {
  const data = await post<{ answer: string }>("/advisor", { plan, question });
  return data.answer;
}
