"use client";

import { useEffect, useRef, useState } from "react";
import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline from "@/components/Timeline";
import CourseCatalog from "@/components/CourseCatalog";
import Advisor from "@/components/Advisor";
import Footer from "@/components/Footer";
import {
  fetchCatalog,
  generatePlan,
  reviewPlan,
  type CatalogCourse,
  type PlannerSettings as Settings,
  type PlanResult,
  type Semester,
} from "@/lib/api";

export default function Home() {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [undoStack, setUndoStack] = useState<PlanResult[]>([]);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);

  useEffect(() => {
    fetchCatalog().then(setCatalog).catch(console.error);
  }, []);

  // keep the previous version so edits can be undone
  function commit(next: PlanResult) {
    if (result) setUndoStack((stack) => [...stack.slice(-19), result]);
    setResult(next);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) return;
    latestRequest.current++;  // ignore any review still in flight
    setUndoStack((stack) => stack.slice(0, -1));
    setResult(previous);
  }

  async function handleGenerate(next: Settings) {
    // settings can change quickly (e.g. dragging the slider); only the newest response wins
    const requestId = ++latestRequest.current;
    setSettings(next);
    setLoading(true);

    try {
      const plan = await generatePlan(next);
      if (requestId === latestRequest.current) {
        setResult(plan);
        setUndoStack([]);
      }
    } catch (err) {
      console.error(err);
      if (requestId === latestRequest.current) alert("Backend not reachable");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  async function handleEdit(plan: Semester[]) {
    if (!result || !settings) return;

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

  return (
    <div id="top" className="min-h-screen">

      {/* HERO */}
      <Hero />

      <main className="px-4">
        {/* SETTINGS */}
        <PlannerSettings onGenerate={handleGenerate} loading={loading} autoUpdate={result !== null} />

        {/* TIMELINE + CATALOG */}
        <div className={`mx-auto mt-12 grid gap-8 ${result ? "max-w-7xl lg:grid-cols-[1fr_20rem]" : "max-w-5xl"}`}>
          <Timeline
            result={result}
            catalog={catalog}
            onEdit={handleEdit}
            onUndo={undo}
            canUndo={undoStack.length > 0}
          />
          {result && (
            <div>
              <CourseCatalog
                catalog={catalog}
                result={result}
                onRemove={(code) => handleEdit(result.plan.map((s) => {
                  const courses = s.courses.filter((c) => c.code !== code);
                  return { ...s, courses, units: courses.reduce((sum, c) => sum + c.units, 0) };
                }))}
              />
            </div>
          )}
        </div>

        {/* AI Advisor */}
        {result && settings && result.plan.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl">
            <Advisor plan={result.plan} settings={settings} onPlanChange={commit} onUndo={undo} />
          </div>
        )}
      </main>

      <Footer />

    </div>
  );
}
