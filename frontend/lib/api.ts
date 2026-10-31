const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export type Category = "core" | "hss" | "ethics" | "elective";

export interface Course {
  code: string;
  title: string;
  units: number;
  category: Category;
}

export interface CatalogCourse extends Course {
  prereqs: string[];
  terms: string[];
  design: boolean;      // satisfies the major design requirement
  upper_eecs: boolean;  // counts toward the 20 upper-division EECS units
}

export interface ApExam {
  key: string;
  label: string;
  group: string;
  units: number;
  min_score: number;  // lowest score that earns anything
  credit: { min_score: number; courses: string[] }[];  // "HSS" = one breadth course
}

export interface Semester {
  term: string;
  courses: Course[];
  units: number;
}

export interface Issue {
  term: string;
  course: string | null;  // null = the whole semester (e.g. over the unit limit)
  message: string;
}

export interface PlanResult {
  plan: Semester[];
  total_units: number;
  ap_credit: string[];
  ap_units: number;
  upper_eecs_units: number;
  warnings: string[];
  issues: Issue[];
}

export interface PlannerSettings {
  timeline: number;
  maxUnits: number;
  summer: boolean;
  ap: Record<string, number>;  // AP exam key -> score (3-5)
}

export interface ChatMessage {
  role: "student" | "advisor";
  text: string;
}

export interface AdvisorResponse {
  answer: string;
  error: boolean;  // answer is a friendly error message (e.g. advisor busy)
  changes: string[];
  skipped: string[];
  result: PlanResult | null;  // the edited plan, if the advisor changed anything
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, body === undefined ? undefined : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }

  return res.json();
}

export function fetchCatalog(): Promise<CatalogCourse[]> {
  return request<CatalogCourse[]>("/courses");
}

export function fetchApExams(): Promise<ApExam[]> {
  return request<ApExam[]>("/ap-exams");
}

export function generatePlan(settings: PlannerSettings): Promise<PlanResult> {
  // incoming students have no completed courses
  return request<PlanResult>("/generate-plan", { completed_courses: [], settings });
}

export function reviewPlan(plan: Semester[], settings: PlannerSettings): Promise<PlanResult> {
  return request<PlanResult>("/review-plan", { plan, settings });
}

export function askAdvisor(
  plan: Semester[],
  question: string,
  settings: PlannerSettings,
  history: ChatMessage[],
): Promise<AdvisorResponse> {
  return request<AdvisorResponse>("/advisor", { plan, question, settings, history });
}
