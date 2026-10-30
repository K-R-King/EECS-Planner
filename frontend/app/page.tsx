"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline from "@/components/Timeline";
import Advisor from "@/components/Advisor";
import { generatePlan, type PlannerSettings as Settings, type PlanResult } from "@/lib/api";

export default function Home() {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(settings: Settings) {
    setLoading(true);

    try {
      setResult(await generatePlan(settings));
    } catch (err) {
      console.error(err);
      alert("Backend not reachable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-20">

      {/* HERO */}
      <Hero />

      <main className="px-4">
        {/* SETTINGS */}
        <PlannerSettings onGenerate={handleGenerate} loading={loading} />

        {/* TIMELINE */}
        <Timeline result={result} />

        {/* AI Advisor */}
        {result && result.plan.length > 0 && (
          <Advisor plan={result.plan} />
        )}
      </main>

      <footer className="mt-16 text-center text-xs text-slate-400">
        Unofficial planning tool. Always confirm requirements with your EECS advisor.
      </footer>

    </div>
  );
}
