"use client";

import { useState } from "react";
import Hero from "@/components/Hero";
import PlannerSettings from "@/components/PlannerSettings";
import Timeline from "@/components/Timeline";
import Advisor from "@/components/Advisor";
import { generatePlan, type PlannerSettings as Settings, type Semester } from "@/lib/api";

export default function Home() {
  const [plan, setPlan] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleGenerate(settings: Settings) {
    setLoading(true);

    try {
      setPlan(await generatePlan(settings));
    } catch (err) {
      console.error(err);
      alert("Backend not reachable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-20">

      {/* HERO */}
      <Hero />

      {/* SETTINGS */}
      <PlannerSettings onGenerate={handleGenerate} loading={loading} />

      {/* LOADING STATE */}
      {loading && (
        <div className="text-center mt-6 text-gray-600">
          Generating your EECS roadmap...
        </div>
      )}

      {/* TIMELINE */}
      <Timeline plan={plan} />

      {/* AI Advisor */}
      {plan.length > 0 && (
        <Advisor plan={plan} />
      )}

    </div>
  );
}
