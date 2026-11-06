import { HOME_URL, SUITE } from "@/lib/suite";

// Each EECS site lives on its own address, so browser storage isn't shared between them. The courses a
// student has marked as taken travel in the links instead (?taken=CS61A.CS61B), and every site remembers
// the last list it saw, so a trip through the Hub or Links keeps it. Codes follow EECS Prereqs (EE16A,
// CSC100); the Planner translates its own. The same file lives in all five sites.

const STORAGE_KEY = "eecs-suite:taken";
const PARAM = "taken";
const CODE = /^[A-Z]+\d+[A-Z]*$/;

// Internship Finder has no use for the list, so it stays out of that site's links
const SUITE_ORIGINS = new Set(
  [HOME_URL, ...SUITE.filter((s) => s.id !== "internships").map((s) => s.url)].map((url) => {
    try {
      return new URL(url).origin;
    } catch {
      return "";
    }
  }),
);

const clean = (codes: unknown[]) => [
  ...new Set(codes.filter((c): c is string => typeof c === "string").map((c) => c.trim().toUpperCase()).filter((c) => CODE.test(c))),
];

/** The last taken list this site saw, its own or one passed in from a sister site. */
export function rememberedTaken(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? clean(parsed) : [];
  } catch {
    return [];
  }
}

/** Call whenever this site's taken list changes, so links to the sister sites carry it. */
export function rememberTaken(codes: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clean(codes)));
  } catch {
    // storage blocked (e.g. private browsing); the list just won't travel
  }
}

let incoming: string[] | null | undefined;

/**
 * The taken list this page was opened with (?taken=...), or null if none. The first call removes it
 * from the address bar (so it isn't bookmarked or shared) and remembers it; later calls return the same list.
 */
export function takeIncoming(): string[] | null {
  if (incoming !== undefined) return incoming;
  const url = new URL(window.location.href);
  const raw = url.searchParams.get(PARAM);
  if (raw === null) return (incoming = null);
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  incoming = clean(raw.split("."));
  rememberTaken([...rememberedTaken(), ...incoming]);
  return incoming;
}

/** `url` with this site's taken list added, if it points at a sister site. */
export function withTaken(url: string): string {
  try {
    const target = new URL(url, window.location.href);
    if (!SUITE_ORIGINS.has(target.origin) || target.origin === window.location.origin) return url;
    const codes = rememberedTaken();
    if (codes.length) target.searchParams.set(PARAM, codes.join("."));
    else target.searchParams.delete(PARAM);
    return target.toString();
  } catch {
    return url;
  }
}
