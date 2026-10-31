"use client";

import { useState } from "react";
import type { ApExam, CatalogCourse, FocusTracks, PlannerSettings as Settings } from "@/lib/api";
import { creditFor, groupExams } from "@/lib/apExams";

interface Props {
  initial: Settings;
  apExams: ApExam[];
  focusTracks: FocusTracks["tracks"];
  catalog: CatalogCourse[];
  // returns false if the change was cancelled (e.g. the student kept their edited plan)
  onGenerate: (settings: Settings) => boolean;
  loading: boolean;
  // once a plan exists, every settings change regenerates it right away
  autoUpdate: boolean;
  slow: boolean;         // the server is taking a while (waking up)
  catalogYear: string;   // whose requirements these are, e.g. "2026–27"
}

const TIMELINES = [
  { value: 4, label: "4 years", hint: "Standard" },
  { value: 3.5, label: "3.5 years", hint: "Early" },
  { value: 3, label: "3 years", hint: "Fast track" },
];

const SCORES = [3, 4, 5];

export default function PlannerSettings({ initial, apExams, focusTracks, catalog, onGenerate, loading, autoUpdate, slow, catalogYear }: Props) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [showAp, setShowAp] = useState(false);
  const [showTaken, setShowTaken] = useState(false);
  const [takenQuery, setTakenQuery] = useState("");

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

  function toggleTaken(code: string) {
    const completed = settings.completed.includes(code)
      ? settings.completed.filter((c) => c !== code)
      : [...settings.completed, code];
    update({ completed });
  }

  const selectedCount = Object.keys(settings.ap).length;
  const takenMatches = takenQuery
    ? catalog
        .filter((c) => c.category !== "hss" && !settings.completed.includes(c.code))
        .filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(takenQuery.toLowerCase()))
        .slice(0, 8)
    : [];

  return (
    <section id="settings" className="relative z-10 mx-auto -mt-24 max-w-5xl scroll-mt-6 rounded-3xl border border-white/60 bg-white/95 dark:bg-slate-900/95 p-6 shadow-2xl shadow-berkeley/20 backdrop-blur sm:p-8 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-berkeley dark:text-blue-300">Plan settings</h2>
          {catalogYear && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Uses the {catalogYear} requirements, for students entering Fall {catalogYear.slice(0, 4)}.
            </p>
          )}
        </div>
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
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Graduation timeline</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TIMELINES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => update({ timeline: t.value })}
                aria-pressed={settings.timeline === t.value}
                className={`rounded-xl border px-2 py-2 text-center transition ${
                  settings.timeline === t.value
                    ? "border-berkeley bg-berkeley text-white shadow"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-berkeley-light"
                }`}
              >
                <span className="block text-sm font-semibold">{t.label}</span>
                <span className={`block text-xs ${settings.timeline === t.value ? "text-gold" : "text-slate-500 dark:text-slate-400"}`}>
                  {t.hint}
                </span>
              </button>
            ))}
          </div>

          <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm transition hover:border-berkeley-light">
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-200">☀️ Include summer sessions</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Adds empty summers you can drag courses into</span>
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
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Max units per semester</p>
            <span className="text-2xl font-bold text-berkeley dark:text-blue-300">{settings.maxUnits}</span>
          </div>
          <input
            type="range"
            aria-label="Max units per semester"
            min="12"
            max="20"
            value={settings.maxUnits}
            onChange={(e) => update({ maxUnits: Number(e.target.value) })}
            className="mt-4 w-full"
          />
          <div className="mt-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>12 · lighter</span>
            <span>20 · heavier</span>
          </div>
        </div>
      </div>

      {/* Focus */}
      <div className="mt-8">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Focus <span className="text-slate-500 dark:text-slate-400">· picks electives that match your interests</span></p>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Focus">
          {focusTracks.map((track) => (
            <button
              key={track.key}
              type="button"
              role="radio"
              aria-checked={settings.focus === track.key}
              onClick={() => update({ focus: track.key })}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                settings.focus === track.key
                  ? "border-berkeley bg-berkeley font-semibold text-white shadow"
                  : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-berkeley-light"
              }`}
            >
              {track.label}
            </button>
          ))}
        </div>
      </div>

      {/* Courses already taken */}
      <div className="mt-8 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 ring-1 ring-slate-200 dark:ring-slate-700">
        <button
          type="button"
          onClick={() => setShowTaken(!showTaken)}
          aria-expanded={showTaken}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Courses already taken</span>
            <span className="block text-xs text-slate-500 sm:ml-2 sm:inline dark:text-slate-400">community college, dual enrollment, or earlier at Berkeley</span>
          </span>
          <span className="flex items-center gap-3 text-sm">
            {settings.completed.length > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-berkeley">
                {settings.completed.length} taken
              </span>
            )}
            <span className="text-berkeley dark:text-blue-300">{showTaken ? "Hide ▲" : "Add courses ▼"}</span>
          </span>
        </button>

        {showTaken && (
          <div className="mt-4">
            {settings.completed.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {settings.completed.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => toggleTaken(code)}
                    aria-label={`Remove ${code} from courses taken`}
                    className="rounded-full border border-gold bg-gold/15 px-3 py-1 text-xs font-semibold text-berkeley dark:text-blue-300"
                  >
                    ✓ {code} ×
                  </button>
                ))}
              </div>
            )}
            <input
              value={takenQuery}
              onChange={(e) => setTakenQuery(e.target.value)}
              placeholder="Search, e.g. Math 51 or CS 61A"
              aria-label="Search courses you've already taken"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-berkeley-light"
            />
            {takenMatches.length > 0 && (
              <ul tabIndex={0} aria-label="Matching courses" className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                {takenMatches.map((c) => (
                  <li key={c.code}>
                    <button
                      type="button"
                      onClick={() => {
                        toggleTaken(c.code);
                        setTakenQuery("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gold/10"
                    >
                      <span className="font-semibold">{c.code}</span>
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* AP Credits */}
      <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 p-4 ring-1 ring-slate-200 dark:ring-slate-700">
        <button
          type="button"
          onClick={() => setShowAp(!showAp)}
          aria-expanded={showAp}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">AP credit</span>
            <span className="block text-xs text-slate-500 sm:ml-2 sm:inline dark:text-slate-400">all {apExams.length} exams · Berkeley Engineering rules</span>
          </span>
          <span className="flex items-center gap-3 text-sm">
            {selectedCount > 0 && (
              <span className="rounded-full bg-gold px-2.5 py-0.5 text-xs font-bold text-berkeley">
                {selectedCount} selected
              </span>
            )}
            <span className="text-berkeley dark:text-blue-300">{showAp ? "Hide ▲" : "Choose exams ▼"}</span>
          </span>
        </button>

        {showAp && (
          <div className="mt-4 space-y-5">
            {groupExams(apExams).map((group) => (
              <div key={group.name}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                          selected ? "border-gold bg-gold/15 shadow-sm" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-berkeley-light"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setScore(exam.key, selected ? null : 5)}
                          className={`px-3 py-1.5 ${selected ? "font-semibold text-berkeley dark:text-blue-300" : "text-slate-600 dark:text-slate-300"}`}
                        >
                          {selected && "✓ "}
                          {exam.label}
                          <span className="ml-1.5 font-normal text-slate-500 dark:text-slate-400">
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
                                  score === s ? "bg-berkeley text-white" : "text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700"
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
            <p className="text-xs text-slate-500 dark:text-slate-400">
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
        {loading ? (slow ? "Waking up the server… the first plan can take up to a minute" : "Building your roadmap...") : autoUpdate ? "Regenerate plan ↻" : `Generate my ${settings.timeline}-year plan →`}
      </button>
    </section>
  );
}
