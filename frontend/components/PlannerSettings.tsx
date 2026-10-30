"use client";

import { useState } from "react";
import type { PlannerSettings as Settings } from "@/lib/api";
import { AP_GROUPS, AP_EXAM_COUNT } from "@/lib/apExams";

interface Props {
  onGenerate: (settings: Settings) => void;
  loading: boolean;
  // once a plan exists, every settings change regenerates it right away
  autoUpdate: boolean;
}

const TIMELINES = [
  { value: 4, label: "4 years", hint: "Standard" },
  { value: 3.5, label: "3.5 years", hint: "Early" },
  { value: 3, label: "3 years", hint: "Fast track" },
];

export default function PlannerSettings({ onGenerate, loading, autoUpdate }: Props) {
  const [settings, setSettings] = useState<Settings>({ timeline: 4, maxUnits: 16, ap: [] });
  const [showAp, setShowAp] = useState(false);

  function update(changes: Partial<Settings>) {
    const next = { ...settings, ...changes };
    setSettings(next);
    if (autoUpdate) onGenerate(next);
  }

  function toggleAp(key: string) {
    const ap = settings.ap.includes(key)
      ? settings.ap.filter((k) => k !== key)
      : [...settings.ap, key];
    update({ ap });
  }

  return (
    <section id="settings" className="relative z-10 mx-auto -mt-24 scroll-mt-6 max-w-5xl rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl shadow-berkeley/20 backdrop-blur sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-berkeley">Plan settings</h2>
        {autoUpdate && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live: changes update your plan instantly
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {/* Timeline */}
        <div>
          <p className="text-sm font-medium text-slate-600">Graduation timeline</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TIMELINES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ timeline: t.value })}
                className={`rounded-xl border px-2 py-2 text-center transition ${
                  settings.timeline === t.value
                    ? "border-berkeley bg-berkeley text-white shadow"
                    : "border-slate-200 text-slate-700 hover:border-berkeley-light"
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`block text-xs ${settings.timeline === t.value ? "text-gold" : "text-slate-400"}`}>
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
            <span className="text-2xl font-bold text-berkeley">{settings.maxUnits}</span>
          </div>
          <input
            type="range"
            min="12"
            max="20"
            value={settings.maxUnits}
            onChange={(e) => update({ maxUnits: Number(e.target.value) })}
            className="mt-4 w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>12 · lighter</span>
            <span>20 · heavier</span>
          </div>
        </div>
      </div>

      {/* AP Credits */}
      <div className="mt-8 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
        <button
          type="button"
          onClick={() => setShowAp(!showAp)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="text-sm font-semibold text-slate-700">AP credit</span>
            <span className="ml-2 text-xs text-slate-400">scores of 4–5 · all {AP_EXAM_COUNT} exams</span>
          </span>
          <span className="flex items-center gap-3 text-sm">
            {settings.ap.length > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-berkeley">
                {settings.ap.length} selected
              </span>
            )}
            <span className="text-berkeley">{showAp ? "Hide ▲" : "Choose exams ▼"}</span>
          </span>
        </button>

        {showAp && (
          <div className="mt-4 space-y-5">
            {AP_GROUPS.map((group) => (
              <div key={group.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.exams.map((exam) => {
                    const selected = settings.ap.includes(exam.key);
                    return (
                      <button
                        key={exam.key}
                        type="button"
                        onClick={() => toggleAp(exam.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          selected
                            ? "border-gold bg-gold font-semibold text-berkeley shadow-sm"
                            : "border-slate-200 bg-white text-slate-600 hover:border-berkeley-light"
                        }`}
                      >
                        {selected && "✓ "}
                        {exam.label}
                        <span className={`ml-1.5 ${selected ? "text-berkeley/70" : "text-slate-400"}`}>
                          · {exam.credit}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400">
              &ldquo;Breadth&rdquo; fills a Humanities/Social Sciences requirement. &ldquo;Units&rdquo; counts toward
              graduation but doesn&apos;t replace a course in this plan.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => onGenerate(settings)}
        disabled={loading}
        className="mt-8 w-full rounded-xl bg-linear-to-r from-gold to-amber-400 py-3.5 font-semibold text-berkeley shadow-lg shadow-gold/30 transition hover:-translate-y-0.5 hover:shadow-xl disabled:opacity-50"
      >
        {loading ? "Building your roadmap..." : autoUpdate ? "Regenerate plan ↻" : `Generate my ${settings.timeline}-year plan →`}
      </button>
    </section>
  );
}
