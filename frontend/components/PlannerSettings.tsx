"use client";

import { useState } from "react";
import type { ApExam, PlannerSettings as Settings } from "@/lib/api";
import { creditFor, groupExams } from "@/lib/apExams";

interface Props {
  initial: Settings;
  apExams: ApExam[];
  // returns false if the change was cancelled (e.g. the student kept their edited plan)
  onGenerate: (settings: Settings) => boolean;
  loading: boolean;
  // once a plan exists, every settings change regenerates it right away
  autoUpdate: boolean;
}

const TIMELINES = [
  { value: 4, label: "4 years", hint: "Standard" },
  { value: 3.5, label: "3.5 years", hint: "Early" },
  { value: 3, label: "3 years", hint: "Fast track" },
];

const SCORES = [3, 4, 5];

export default function PlannerSettings({ initial, apExams, onGenerate, loading, autoUpdate }: Props) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [showAp, setShowAp] = useState(false);

  function update(changes: Partial<Settings>) {
    const next = { ...settings, ...changes };
    if (autoUpdate && !onGenerate(next)) return;
    setSettings(next);
  }

  function setScore(key: string, score: number | null) {
    const ap = { ...settings.ap };
    if (score === null) delete ap[key];
    else ap[key] = score;
    update({ ap });
  }

  const selectedCount = Object.keys(settings.ap).length;

  return (
    <section id="settings" className="relative z-10 mx-auto -mt-24 max-w-5xl scroll-mt-6 rounded-3xl border border-white/60 bg-white/95 p-6 shadow-2xl shadow-berkeley/20 backdrop-blur sm:p-8 print:hidden">
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

          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition hover:border-berkeley-light">
            <span>
              <span className="font-medium text-slate-700">☀️ Include summer sessions</span>
              <span className="block text-xs text-slate-400">Adds empty summers you can drag courses into</span>
            </span>
            <input
              type="checkbox"
              className="h-4 w-4 accent-berkeley"
              checked={settings.summer}
              onChange={(e) => update({ summer: e.target.checked })}
            />
          </label>
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
            <span className="ml-2 text-xs text-slate-400">all {apExams.length} exams · Berkeley Engineering rules</span>
          </span>
          <span className="flex items-center gap-3 text-sm">
            {selectedCount > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-berkeley">
                {selectedCount} selected
              </span>
            )}
            <span className="text-berkeley">{showAp ? "Hide ▲" : "Choose exams ▼"}</span>
          </span>
        </button>

        {showAp && (
          <div className="mt-4 space-y-5">
            {groupExams(apExams).map((group) => (
              <div key={group.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {group.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.exams.map((exam) => {
                    const score = settings.ap[exam.key];
                    const selected = score !== undefined;
                    return (
                      <div
                        key={exam.key}
                        className={`flex items-center overflow-hidden rounded-full border text-xs transition ${
                          selected ? "border-gold bg-gold/15 shadow-sm" : "border-slate-200 bg-white hover:border-berkeley-light"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setScore(exam.key, selected ? null : 5)}
                          className={`px-3 py-1.5 ${selected ? "font-semibold text-berkeley" : "text-slate-600"}`}
                        >
                          {selected && "✓ "}
                          {exam.label}
                          <span className="ml-1.5 font-normal text-slate-400">
                            · {creditFor(exam, score ?? 5)}
                          </span>
                        </button>
                        {selected && (
                          <span className="flex border-l border-gold/40 pr-1" aria-label={`${exam.label} score`}>
                            {SCORES.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => setScore(exam.key, s)}
                                className={`mx-0.5 my-1 h-5 w-5 rounded-full text-[11px] font-bold transition ${
                                  score === s ? "bg-berkeley text-white" : "text-slate-500 hover:bg-white"
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400">
              Pick your score for each exam. &ldquo;Breadth&rdquo; fills a Humanities/Social Sciences course (AP can
              cover at most 2 of the 6). &ldquo;Units&rdquo; counts toward the 120 needed to graduate.
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
