"use client";

import { useEffect, useRef, useState } from "react";
import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline, { placeCourse } from "@/components/Timeline";
import CourseCatalog from "@/components/CourseCatalog";
import Advisor from "@/components/Advisor";
import Footer from "@/components/Footer";
import {
  fetchApExams,
  fetchCatalog,
  generatePlan,
  reviewPlan,
  type ApExam,
  type CatalogCourse,
  type PlannerSettings as Settings,
  type PlanResult,
  type Semester,
} from "@/lib/api";
import { clearShareLink, loadSaved, readShareLink, save, shareLink } from "@/lib/share";

const DEFAULT_SETTINGS: Settings = { timeline: 4, maxUnits: 16, summer: false, ap: {} };

export default function Home() {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [edited, setEdited] = useState(false);
  const [undoStack, setUndoStack] = useState<PlanResult[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [apExams, setApExams] = useState<ApExam[]>([]);
  const [loading, setLoading] = useState(false);
  // bumped when settings are restored, so the settings panel re-reads them
  const [restoreCount, setRestoreCount] = useState(0);
  const [restored, setRestored] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(console.error);
    fetchApExams().then(setApExams).catch(console.error);

    // a shared link wins over whatever this browser saved
    const shared = readShareLink();
    if (shared) {
      clearShareLink();
      reviewPlan(shared.plan, shared.settings)
        .then((checked) => {
          setSettings(shared.settings);
          setResult(checked);
          setEdited(true);
          setRestoreCount((n) => n + 1);
        })
        .catch(console.error)
        .finally(() => setRestored(true));
      return;
    }

    Promise.resolve(loadSaved()).then((saved) => {
      if (saved) {
        setSettings(saved.settings);
        setResult(saved.result);
        setEdited(saved.edited);
        setRestoreCount((n) => n + 1);
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

  function handleGenerate(next: Settings): boolean {
    if (result && edited && !window.confirm("Changing settings rebuilds your plan, and your edits will be lost. Continue?")) {
      return false;
    }

    // settings can change quickly (e.g. dragging the slider); only the newest response wins
    const requestId = ++latestRequest.current;
    setSettings(next);
    setLoading(true);

    generatePlan(next)
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
        if (requestId === latestRequest.current) setLoading(false);
      });

    return true;
  }

  async function handleEdit(plan: Semester[]) {
    if (!result) return;

    // show the edit immediately, then let the backend re-check it
    const requestId = ++latestRequest.current;
    commit({ ...result, plan, issues: [] });

    try {
      const checked = await reviewPlan(plan, settings);
      if (requestId === latestRequest.current) setResult(checked);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleShare(): Promise<boolean> {
    if (!result) return false;
    try {
      await navigator.clipboard.writeText(shareLink(settings, result.plan));
      return true;
    } catch {
      return false;
    }
  }

  return (
    <div id="top" className="min-h-screen">

      {/* HERO */}
      <Hero />

      {/* shown only when printing */}
      <div className="hidden px-4 pb-4 print:block">
        <h1 className="text-2xl font-bold text-berkeley">My UC Berkeley EECS Plan</h1>
        <p className="text-xs text-slate-500">Unofficial planning tool. Confirm requirements with your EECS advisor.</p>
      </div>

      <main className="px-4">
        {/* SETTINGS */}
        <PlannerSettings
          key={restoreCount}
          initial={settings}
          apExams={apExams}
          onGenerate={handleGenerate}
          loading={loading}
          autoUpdate={result !== null}
        />

        {/* TIMELINE + CATALOG */}
        <div className={`mx-auto mt-12 grid gap-8 print:mt-0 ${result ? "max-w-7xl lg:grid-cols-[1fr_20rem] print:block" : "max-w-5xl"}`}>
          <Timeline
            result={result}
            catalog={catalog}
            onEdit={handleEdit}
            onUndo={undo}
            canUndo={undoStack.length > 0}
            onShare={handleShare}
          />
          {result && (
            <div className="print:hidden">
              <CourseCatalog
                catalog={catalog}
                result={result}
                onRemove={(code) => handleEdit(placeCourse(result.plan, catalog, code, null))}
              />
            </div>
          )}
        </div>

        {/* AI Advisor */}
        {result && result.plan.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl print:hidden">
            <Advisor plan={result.plan} settings={settings} onPlanChange={commit} onUndo={undo} />
          </div>
        )}
      </main>

      <Footer />

    </div>
  );
}
