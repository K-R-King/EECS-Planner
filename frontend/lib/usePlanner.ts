"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchApExams,
  fetchCatalog,
  fetchFocusTracks,
  generatePlan,
  rateSemesters,
  ratingKey,
  reviewPlan,
  type ApExam,
  type CatalogCourse,
  type FocusTracks,
  type PlannerSettings as Settings,
  type PlanResult,
  type Rating,
  type Semester,
} from "@/lib/api";
import { rememberedTaken, rememberTaken, takeIncoming } from "@/lib/handoff";
import { clearShareLink, loadSaved, readShareLink, save, shareLink } from "@/lib/share";
import { fromPrereqsCode, toPrereqsCode } from "@/lib/suite";

// wait for edits to stop before asking Gemini to rate semesters, since each request counts against a low limit
const RATING_DELAY = 1200;
const RATINGS_KEY = "eecs-planner:ratings:v2";

/** Ratings this browser already has, so a refresh or return visit asks Gemini for nothing it's been told. */
function loadRatings(): Record<string, Rating | null> {
  try {
    return typeof window === "undefined" ? {} : JSON.parse(localStorage.getItem(RATINGS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** Leaves out failed ratings, so they're tried again on the next visit. */
function saveRatings(ratings: Record<string, Rating | null>) {
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(Object.fromEntries(Object.entries(ratings).filter(([, r]) => r !== null))));
  } catch {
    // storage can be blocked; ratings then last until the page closes
  }
}

export const DEFAULT_SETTINGS: Settings = {
  timeline: 4, maxUnits: 16, summer: false, winter: false, ap: {}, focus: "balanced", completed: [], picks: {}, electives: [], transfers: [],
};

/** Electives picked on EECS Electives (?electives=CS189.CS162, Prereqs codes), removed from the address bar. */
function takeIncomingElectives(): string[] | null {
  const url = new URL(window.location.href);
  const raw = url.searchParams.get("electives");
  if (raw === null) return null;
  url.searchParams.delete("electives");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  return raw.split(".").map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]+\d+[A-Z]*$/.test(c));
}

/**
 * All of the planner's state: the plan, its settings, undo history, saving/sharing,
 * and the reference data (course catalog, AP exams, focus tracks) loaded from the backend.
 */
export function usePlanner() {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [edited, setEdited] = useState(false);
  const [undoStack, setUndoStack] = useState<PlanResult[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [apExams, setApExams] = useState<ApExam[]>([]);
  const [focusTracks, setFocusTracks] = useState<FocusTracks>({ tracks: [], offerings_checked: null, catalog_year: "" });
  const [loading, setLoading] = useState(false);
  // a free-tier server sleeps when idle; if a request takes a while, say so
  const [slow, setSlow] = useState(false);
  // bumped when settings are restored, so the settings panel re-reads them
  const [restoreCount, setRestoreCount] = useState(0);
  const [restored, setRestored] = useState(false);
  // only the newest plan request may update the page (settings can change quickly)
  const latestRequest = useRef(0);
  // courses marked as taken on a sister site (?taken=...), added once the catalog and saved plan are in
  const incomingTaken = useRef<string[] | null>(null);
  const incomingElectives = useRef<string[] | null>(null);
  // a message about something the page couldn't do, shown until dismissed
  const [notice, setNotice] = useState<string | null>(null);
  // difficulty out of 10 for semesters rated so far (see ratingKey); null means it couldn't be rated
  const [ratings, setRatings] = useState<Record<string, Rating | null>>(loadRatings);

  useEffect(() => {
    // reading these clears them, and this effect can run twice on load, so keep what the first run found
    incomingTaken.current ??= takeIncoming();
    incomingElectives.current ??= takeIncomingElectives();
    fetchCatalog().then(setCatalog).catch(console.error);
    fetchApExams().then(setApExams).catch(console.error);
    fetchFocusTracks().then(setFocusTracks).catch(console.error);

    function restore(saved: Settings, plan: PlanResult | null, wasEdited: boolean) {
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setResult(plan);
      setEdited(wasEdited);
      setRestoreCount((n) => n + 1);
    }

    function restoreSaved() {
      const saved = loadSaved();
      if (saved) {
        restore({ ...saved.settings, picks: { ...saved.picks, ...saved.settings.picks } }, saved.result, saved.edited);
      }
    }

    // a shared link wins over whatever this browser saved
    const shared = readShareLink();
    if (shared) {
      const sharedSettings = { ...DEFAULT_SETTINGS, ...shared.settings };
      reviewPlan(shared.plan, sharedSettings)
        .then((checked) => {
          clearShareLink();
          restore(sharedSettings, checked, true);
        })
        .catch((err) => {
          // keep the link (a refresh tries again) and this browser's own plan, which would otherwise
          // be saved over with an empty one
          console.error(err);
          restoreSaved();
          alert("Couldn't open the shared plan right now. Refresh the page to try again.");
        })
        .finally(() => setRestored(true));
      return;
    }

    Promise.resolve().then(() => {
      restoreSaved();
      setRestored(true);
    });
  }, []);

  // courses marked as taken on a sister site go into "courses already taken", and electives picked on
  // EECS Electives (?electives=...) into the plan
  useEffect(() => {
    const takenCodes = incomingTaken.current;
    const electiveCodes = incomingElectives.current;
    if (!restored || !catalog.length || (!takenCodes && !electiveCodes)) return;
    incomingTaken.current = incomingElectives.current = null;

    const byCode = new Map(catalog.map((c) => [c.code, c]));
    const done = new Set([...settings.completed, ...(result?.ap_credit ?? [])]);
    const taken = [...new Set((takenCodes ?? []).map(fromPrereqsCode))].filter((c) => byCode.has(c) && !done.has(c));
    const completed = [...settings.completed, ...taken];

    const wanted = [...new Set((electiveCodes ?? []).map(fromPrereqsCode))];
    const isElective = (c: string) => byCode.get(c)?.category === "elective";
    const missing = wanted.filter((c) => !isElective(c));
    const electives = wanted.filter((c) => isElective(c) && !settings.electives.includes(c) && !completed.includes(c));
    if (missing.length) {
      setNotice(`${missing.join(", ")} ${missing.length === 1 ? "isn't" : "aren't"} in the planner's elective list yet, so ${missing.length === 1 ? "it wasn't" : "they weren't"} added to your plan.`);
    }
    if (!taken.length && !electives.length) return;

    const next = { ...settings, completed, electives: [...settings.electives, ...electives] };
    if (!result && !electives.length) {
      // no plan yet, so just fill in the settings
      setSettings(next);
      setRestoreCount((n) => n + 1);
      return;
    }
    const what = [
      taken.length && `marked ${taken.join(", ")} as taken`,
      electives.length && `picked ${electives.join(", ")} as electives`,
    ].filter(Boolean).join(" and ");
    if (result && edited && !window.confirm(`You ${what} on another EECS site. Rebuild your plan with them? Your edits will be lost.`)) return;
    if (generate(next, { confirmed: true })) setRestoreCount((n) => n + 1);
    // runs once, when both are ready
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored, catalog]);

  // tell the sister sites what's been taken, keeping courses this planner doesn't list
  useEffect(() => {
    if (!restored || !catalog.length) return;
    const known = new Set(catalog.map((c) => c.code));
    const own = [...settings.completed, ...(result?.ap_credit ?? [])].map(toPrereqsCode).filter((c): c is string => !!c);
    const foreign = rememberedTaken().filter((c) => !known.has(fromPrereqsCode(c)));
    rememberTaken([...own, ...foreign]);
  }, [restored, catalog, settings.completed, result?.ap_credit]);

  // rate semesters that are new, sending the whole plan so they're rated alongside the others;
  // moving a course back reuses the rating it had
  useEffect(() => {
    if (!result) return;
    const { picks } = settings;
    const unrated = result.plan.filter((s) => s.courses.length && !(ratingKey(s.courses, picks) in ratings));
    if (!unrated.length) return;

    const timer = setTimeout(() => {
      rateSemesters(result.plan, settings)
        .catch((err) => {
          console.error(err);
          return {} as Record<string, Rating | null>;
        })
        .then((rated) => setRatings((known) => ({
          ...known,
          ...Object.fromEntries(unrated.map((s) => [ratingKey(s.courses, picks), rated[s.term] ?? null])),
        })));
    }, RATING_DELAY);
    return () => clearTimeout(timer);
  }, [result, settings, ratings]);

  useEffect(() => saveRatings(ratings), [ratings]);

  // keep the plan across refreshes (only after restoring, so we don't overwrite it with nothing)
  useEffect(() => {
    if (restored) save({ settings, result, edited });
  }, [restored, settings, result, edited]);

  // keep the previous version so edits can be undone
  function commit(next: PlanResult) {
    if (result) setUndoStack((stack) => [...stack.slice(-19), result]);
    setResult(next);
    setEdited(true);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    latestRequest.current++;  // ignore any review still in flight
    setUndoStack((stack) => stack.slice(0, -1));
    setResult(previous);
  }

  /** Rebuild the plan from settings. Returns false if the student kept their edited plan instead. */
  function generate(next: Settings, { confirmed = false } = {}): boolean {
    if (!confirmed && result && edited && !window.confirm("Changing settings rebuilds your plan, and your edits will be lost. Continue?")) {
      return false;
    }

    const requestId = ++latestRequest.current;
    // slot choices are made on the plan, not in the settings panel, so keep them
    const withPicks = { ...next, picks: settings.picks };
    setSettings(withPicks);
    setLoading(true);
    const slowTimer = setTimeout(() => setSlow(true), 4000);

    generatePlan(withPicks)
      .then((plan) => {
        if (requestId !== latestRequest.current) return;
        setResult(plan);
        setEdited(false);
        setUndoStack([]);
      })
      .catch((err) => {
        console.error(err);
        if (requestId === latestRequest.current) alert("Backend not reachable");
      })
      .finally(() => {
        clearTimeout(slowTimer);
        if (requestId === latestRequest.current) {
          setLoading(false);
          setSlow(false);
        }
      });

    return true;
  }

  /** Apply a suggested settings change (e.g. "Add summer sessions") and rebuild the plan. */
  function applyFix(changes: Partial<Settings>) {
    if (generate({ ...settings, ...changes })) setRestoreCount((n) => n + 1);
  }

  /** Show an edited plan right away, then let the backend re-check it. */
  async function edit(plan: Semester[], withSettings: Settings = settings) {
    if (!result) return;

    const requestId = ++latestRequest.current;
    commit({ ...result, plan, issues: [] });

    try {
      const checked = await reviewPlan(plan, withSettings);
      if (requestId === latestRequest.current) setResult(checked);
    } catch (err) {
      console.error(err);
    }
  }

  /** Choose the real course for a placeholder slot (e.g. PHYSICS 5A for Physics A). Units may change. */
  function pick(code: string, choice: string | null) {
    const picks = { ...settings.picks };
    if (choice) picks[code] = choice;
    else delete picks[code];
    const next = { ...settings, picks };
    setSettings(next);
    if (result) edit(result.plan, next);
  }

  /** Choose the real course for a slot and put the slot in a new place, as one edit (e.g. ENGIN 125 found in "+ Add course"). */
  function pickInto(code: string, choice: string, plan: Semester[]) {
    const next = { ...settings, picks: { ...settings.picks, [code]: choice } };
    setSettings(next);
    edit(plan, next);
  }

  async function share(): Promise<boolean> {
    if (!result) return false;
    try {
      await navigator.clipboard.writeText(shareLink(settings, result.plan));
      return true;
    } catch {
      return false;
    }
  }

  return {
    result, settings, catalog, apExams, focusTracks, loading, slow, restoreCount, ratings,
    notice, dismissNotice: () => setNotice(null),
    canUndo: undoStack.length > 0,
    generate, applyFix, edit, pick, pickInto, commit, undo, share,
  };
}
