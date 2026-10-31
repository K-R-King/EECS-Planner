"use client";

import { useEffect, useRef, useState } from "react";
import {
  fetchApExams,
  fetchCatalog,
  fetchFocusTracks,
  generatePlan,
  reviewPlan,
  type ApExam,
  type CatalogCourse,
  type FocusTracks,
  type PlannerSettings as Settings,
  type PlanResult,
  type Semester,
} from "@/lib/api";
import { clearShareLink, loadSaved, readShareLink, save, shareLink } from "@/lib/share";

export const DEFAULT_SETTINGS: Settings = {
  timeline: 4, maxUnits: 16, summer: false, ap: {}, focus: "balanced", completed: [], picks: {},
};

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

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(console.error);
    fetchApExams().then(setApExams).catch(console.error);
    fetchFocusTracks().then(setFocusTracks).catch(console.error);

    function restore(saved: Settings, plan: PlanResult | null, wasEdited: boolean) {
      setSettings({ ...DEFAULT_SETTINGS, ...saved });
      setResult(plan);
      setEdited(wasEdited);
      setRestoreCount((n) => n + 1);
    }

    // a shared link wins over whatever this browser saved
    const shared = readShareLink();
    if (shared) {
      clearShareLink();
      const sharedSettings = { ...DEFAULT_SETTINGS, ...shared.settings };
      reviewPlan(shared.plan, sharedSettings)
        .then((checked) => restore(sharedSettings, checked, true))
        .catch(console.error)
        .finally(() => setRestored(true));
      return;
    }

    Promise.resolve(loadSaved()).then((saved) => {
      if (saved) {
        restore({ ...saved.settings, picks: { ...saved.picks, ...saved.settings.picks } }, saved.result, saved.edited);
      }
      setRestored(true);
    });
  }, []);

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
  function generate(next: Settings): boolean {
    if (result && edited && !window.confirm("Changing settings rebuilds your plan, and your edits will be lost. Continue?")) {
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
    result, settings, catalog, apExams, focusTracks, loading, slow, restoreCount,
    canUndo: undoStack.length > 0,
    generate, applyFix, edit, pick, commit, undo, share,
  };
}
