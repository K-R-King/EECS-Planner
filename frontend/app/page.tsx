"use client";

import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline, { placeCourse } from "@/components/Timeline";
import CourseCatalog from "@/components/CourseCatalog";
import Advisor from "@/components/Advisor";
import Footer from "@/components/Footer";
import { usePlanner } from "@/lib/usePlanner";

export default function Home() {
  const planner = usePlanner();
  const { result, settings, catalog } = planner;

  return (
    <div id="top" className="min-h-screen">

      {/* HERO */}
      <Hero />

      {/* shown only when printing */}
      <div className="hidden px-4 pb-4 print:block">
        <h1 className="text-2xl font-bold text-berkeley dark:text-blue-300">My UC Berkeley EECS Plan</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Unofficial planning tool. Confirm requirements with your EECS advisor.</p>
      </div>

      <main className="px-4">
        {/* SETTINGS */}
        <PlannerSettings
          key={planner.restoreCount}
          initial={settings}
          apExams={planner.apExams}
          focusTracks={planner.focusTracks.tracks}
          catalog={catalog}
          onGenerate={planner.generate}
          loading={planner.loading}
          slow={planner.slow}
          catalogYear={planner.focusTracks.catalog_year}
          autoUpdate={result !== null}
          planned={result ? new Set(result.plan.flatMap((s) => s.courses.map((c) => c.code))) : null}
        />

        {planner.notice && (
          <div role="status" className="mx-auto mt-6 flex max-w-5xl items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800 print:hidden">
            <span aria-hidden>ℹ️</span>
            <p className="flex-1">{planner.notice}</p>
            <button type="button" onClick={planner.dismissNotice} aria-label="Dismiss" className="font-semibold text-amber-900 hover:text-amber-700 dark:text-amber-100">×</button>
          </div>
        )}

        {/* TIMELINE + CATALOG */}
        <div className={`mx-auto mt-12 grid gap-8 print:mt-0 ${result ? "max-w-7xl lg:grid-cols-[1fr_20rem] print:block" : "max-w-5xl"}`}>
          <Timeline
            result={result}
            catalog={catalog}
            onEdit={planner.edit}
            onUndo={planner.undo}
            canUndo={planner.canUndo}
            onShare={planner.share}
            onFix={planner.applyFix}
            picks={settings.picks}
            onPick={planner.pick}
            onPickInto={planner.pickInto}
            ratings={planner.ratings}
          />
          {result && (
            <div className="print:hidden">
              <CourseCatalog
                catalog={catalog}
                result={result}
                onRemove={(code) => planner.edit(placeCourse(result.plan, catalog, code, null))}
              />
            </div>
          )}
        </div>

        {/* AI Advisor */}
        {result && result.plan.length > 0 && (
          <div className="mx-auto mt-12 max-w-5xl print:hidden">
            <Advisor plan={result.plan} settings={settings} onAccept={planner.commit} onUndo={planner.undo} />
          </div>
        )}
      </main>

      <Footer offeringsChecked={planner.focusTracks.offerings_checked} />

    </div>
  );
}
