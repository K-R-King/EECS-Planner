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
  options: string[];    // real choices for a placeholder slot (e.g. the natural science elective)
}

export interface ApExam {
  key: string;
  label: string;
  group: string;
  units: number;
  min_score: number;  // lowest score that earns anything
  credit: { min_score: number; courses: string[] }[];  // "HSS" = one breadth course
}

export interface FocusTracks {
  tracks: { key: string; label: string }[];
  offerings_checked: string | null;  // when term offerings were last pulled from the EECS site
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
  completed: string[];  // courses taken before Berkeley
  upper_eecs_units: number;
  warnings: string[];
  issues: Issue[];
}

export interface PlannerSettings {
  timeline: number;
  maxUnits: number;
  summer: boolean;
  ap: Record<string, number>;  // AP exam key -> score (3-5)
  focus: string;               // key from /focus-tracks
  completed: string[];         // course codes already taken (community college, dual enrollment)
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
  result: PlanResult | null;  // the plan with the advisor's proposed edits, if any
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

export function fetchFocusTracks(): Promise<FocusTracks> {
  return request<FocusTracks>("/focus-tracks");
}

export function generatePlan(settings: PlannerSettings): Promise<PlanResult> {
  return request<PlanResult>("/generate-plan", { settings });
}

export function reviewPlan(plan: Semester[], settings: PlannerSettings): Promise<PlanResult> {
  return request<PlanResult>("/review-plan", { plan, settings });
}

/** Asks the advisor, calling onText with each new piece of the answer as it's written. */
export async function streamAdvisor(
  plan: Semester[],
  question: string,
  settings: PlannerSettings,
  history: ChatMessage[],
  onText: (text: string) => void,
): Promise<AdvisorResponse> {
  const res = await fetch(`${API_URL}/advisor/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, question, settings, history }),
  });
  if (!res.ok || !res.body) throw new Error(`/advisor/stream failed: ${res.status}`);

  // newline-delimited JSON: {"type": "delta", "text"} ... then {"type": "done", ...reply}
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      if (event.type === "delta") onText(event.text);
      else if (event.type === "done") return event as AdvisorResponse;
    }
  }
  throw new Error("The advisor's reply ended early");
}
