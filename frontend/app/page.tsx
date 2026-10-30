"use client";

import { useRef, useState } from "react";
import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline from "@/components/Timeline";
import Advisor from "@/components/Advisor";
import { generatePlan, type PlannerSettings as Settings, type PlanResult } from "@/lib/api";

export default function Home() {
  const [result, setResult] = useState<PlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const latestRequest = useRef(0);

  async function handleGenerate(settings: Settings) {
    // settings can change quickly (e.g. dragging the slider); only the newest response wins
    const requestId = ++latestRequest.current;
    setLoading(true);

    try {
      const plan = await generatePlan(settings);
      if (requestId === latestRequest.current) setResult(plan);
    } catch (err) {
      console.error(err);
      if (requestId === latestRequest.current) alert("Backend not reachable");
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-20">

      {/* HERO */}
      <Hero />

      <main className="px-4">
        {/* SETTINGS */}
        <PlannerSettings onGenerate={handleGenerate} loading={loading} autoUpdate={result !== null} />

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
