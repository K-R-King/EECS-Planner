import type { PlannerSettings, PlanResult, Semester } from "@/lib/api";

const HASH_PREFIX = "#plan=";
const STORAGE_KEY = "eecs-planner:v3";

export interface SavedState {
  settings: PlannerSettings;
  result: PlanResult | null;
  edited: boolean;  // the student changed the generated plan by hand
  picks: Picks;
}

/** Placeholder slot -> the real course the student picked, e.g. { NATSCI: "CHEM 1A + 1AL (...)" } */
export type Picks = Record<string, string>;

// ---------- share links: settings + course codes, base64 in the URL hash ----------

type SharedPlan = { s: PlannerSettings; p: [string, string[]][]; k?: Picks };

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

export function shareLink(settings: PlannerSettings, plan: Semester[], picks: Picks): string {
  const shared: SharedPlan = { s: settings, p: plan.map((s) => [s.term, s.courses.map((c) => c.code)]), k: picks };
  return `${window.location.origin}${window.location.pathname}${HASH_PREFIX}${toBase64Url(JSON.stringify(shared))}`;
}

/** Reads a shared plan from the URL, if there is one. Courses only carry codes; the backend fills in the rest. */
export function readShareLink(): { settings: PlannerSettings; plan: Semester[]; picks: Picks } | null {
  if (!window.location.hash.startsWith(HASH_PREFIX)) return null;
  try {
    const shared: SharedPlan = JSON.parse(fromBase64Url(window.location.hash.slice(HASH_PREFIX.length)));
    const plan = shared.p.map(([term, codes]) => ({
      term,
      courses: codes.map((code) => ({ code })) as Semester["courses"],
      units: 0,
    }));
    return { settings: shared.s, plan, picks: shared.k ?? {} };
  } catch {
    return null;
  }
}

export function clearShareLink() {
  window.history.replaceState(null, "", window.location.pathname);
}

// ---------- saving in this browser ----------

export function loadSaved(): SavedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function save(state: SavedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or blocked (e.g. private browsing); the plan just won't persist
  }
}
