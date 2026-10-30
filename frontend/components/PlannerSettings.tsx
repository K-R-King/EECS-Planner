"use client";

import { useState } from "react";
import type { PlannerSettings as Settings } from "@/lib/api";

interface Props {
  onGenerate: (settings: Settings) => void;
  loading: boolean;
}

const TIMELINES = [
  { value: 4, label: "4 years", hint: "Standard" },
  { value: 3.5, label: "3.5 years", hint: "Early" },
  { value: 3, label: "3 years", hint: "Fast track" },
];

const AP_EXAMS = [
  { key: "apCalcBC", label: "AP Calculus BC", credit: "Math 1A + 1B" },
  { key: "apPhysicsC", label: "AP Physics C: Mech", credit: "Physics 7A" },
  { key: "apCS", label: "AP Computer Science A", credit: "Units only" },
] as const;

type ApKey = (typeof AP_EXAMS)[number]["key"];

export default function PlannerSettings({ onGenerate, loading }: Props) {
  const [timeline, setTimeline] = useState(4);
  const [maxUnits, setMaxUnits] = useState(16);
  const [ap, setAp] = useState<Record<ApKey, boolean>>({
    apCalcBC: false,
    apPhysicsC: false,
    apCS: false,
  });

  function handleGenerate() {
    onGenerate({ timeline, maxUnits, ...ap });
  }

  return (
    <section className="relative mx-auto -mt-20 max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-berkeley/10 sm:p-8">
      <h2 className="text-lg font-bold text-berkeley">Plan settings</h2>

      <div className="mt-6 grid gap-8 md:grid-cols-3">
        {/* Timeline */}
        <div>
          <p className="text-sm font-medium text-slate-600">Graduation timeline</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TIMELINES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTimeline(t.value)}
                className={`rounded-xl border px-2 py-2 text-center transition ${
                  timeline === t.value
                    ? "border-berkeley bg-berkeley text-white shadow"
                    : "border-slate-200 text-slate-700 hover:border-berkeley-light"
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`block text-xs ${timeline === t.value ? "text-gold" : "text-slate-400"}`}>
                  {t.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Units */}
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-medium text-slate-600">Max units per semester</p>
            <span className="text-2xl font-bold text-berkeley">{maxUnits}</span>
          </div>
          <input
            type="range"
            min="12"
            max="20"
            value={maxUnits}
            onChange={(e) => setMaxUnits(Number(e.target.value))}
            className="mt-4 w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>12 · lighter</span>
            <span>20 · heavier</span>
          </div>
        </div>

        {/* AP Credits */}
        <div>
          <p className="text-sm font-medium text-slate-600">AP credit (score 4–5)</p>
          <div className="mt-3 space-y-2">
            {AP_EXAMS.map((exam) => (
              <label
                key={exam.key}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                  ap[exam.key]
                    ? "border-gold bg-gold/10"
                    : "border-slate-200 hover:border-berkeley-light"
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-berkeley"
                    checked={ap[exam.key]}
                    onChange={(e) => setAp({ ...ap, [exam.key]: e.target.checked })}
                  />
                  {exam.label}
                </span>
                <span className="text-xs text-slate-400">{exam.credit}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="mt-8 w-full rounded-xl bg-gold py-3 font-semibold text-berkeley shadow-md transition hover:bg-gold-dark hover:text-white disabled:opacity-50"
      >
        {loading ? "Building your roadmap..." : `Generate my ${timeline}-year plan →`}
      </button>
    </section>
  );
}
