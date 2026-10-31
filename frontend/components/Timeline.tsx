"use client";

import { useState } from "react";
import type { CatalogCourse, PlanResult, Semester } from "@/lib/api";
import { CATEGORY_STYLES, DRAG_TYPE } from "@/lib/categories";

interface Props {
  result: PlanResult | null;
  catalog: CatalogCourse[];
  onEdit: (plan: Semester[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  onShare: () => Promise<boolean>;
}

const TOTAL_UNITS = 120;
const UPPER_EECS_UNITS = 20;

const SEASON_ICONS: Record<string, string> = { Fall: "🍂", Spring: "🌱", Summer: "☀️" };

/** Remove `code` from wherever it is, then (optionally) put it in `toTerm`. */
export function placeCourse(plan: Semester[], catalog: CatalogCourse[], code: string, toTerm: string | null): Semester[] {
  const found = catalog.find((c) => c.code === code);
  const course = found && { code: found.code, title: found.title, units: found.units, category: found.category };

  return plan.map((s) => {
    let courses = s.courses.filter((c) => c.code !== code);
    if (s.term === toTerm && course) courses = [...courses, course];
    return { ...s, courses, units: courses.reduce((sum, c) => sum + c.units, 0) };
  });
}

export default function Timeline({ result, catalog, onEdit, onUndo, canUndo, onShare }: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ term: string; query: string } | null>(null);
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");

  if (!result) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-40 invert" />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-berkeley text-3xl shadow-lg shadow-berkeley/30">
            🗺️
          </div>
          <p className="mt-5 text-lg font-semibold text-berkeley">Your roadmap will appear here</p>
          <p className="mt-1 text-sm text-slate-500">
            Pick your settings above and hit generate. Then drag courses around to make it yours.
          </p>
        </div>
      </div>
    );
  }

  const { plan, total_units, ap_credit, ap_units, upper_eecs_units, warnings, issues } = result;
  const planned = new Set([...ap_credit, ...plan.flatMap((s) => s.courses.map((c) => c.code))]);
  const hasDesign = plan.some((s) => s.courses.some((c) => catalog.find((k) => k.code === c.code)?.design));

  function move(code: string, toTerm: string | null) {
    onEdit(placeCourse(plan, catalog, code, toTerm));
  }

  async function share() {
    setShared((await onShare()) ? "copied" : "failed");
    setTimeout(() => setShared("idle"), 2500);
  }

  // Group semesters by year label ("Year 1 Fall" -> "Year 1")
  const grouped: Record<string, Semester[]> = {};

  plan.forEach((semester) => {
    const year = semester.term.split(" ").slice(0, 2).join(" ");
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(semester);
  });

  const progress = Math.min(100, Math.round((total_units / TOTAL_UNITS) * 100));

  return (
    <div className="space-y-10">

      {/* Summary */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 print:shadow-none">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Units toward graduation</p>
            <p className="text-3xl font-extrabold text-berkeley">
              {total_units}
              <span className="text-lg font-semibold text-slate-400"> / {TOTAL_UNITS}</span>
            </p>
            {ap_units > 0 && <p className="text-xs text-slate-400">includes {ap_units} AP units</p>}
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-slate-500">Upper-div EECS</p>
              <p className={`text-xl font-bold ${upper_eecs_units >= UPPER_EECS_UNITS ? "text-emerald-600" : "text-amber-600"}`}>
                {upper_eecs_units}/{UPPER_EECS_UNITS} {upper_eecs_units >= UPPER_EECS_UNITS && "✓"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Design course</p>
              <p className={`text-xl font-bold ${hasDesign ? "text-emerald-600" : "text-amber-600"}`}>
                {hasDesign ? "✓ Yes" : "Needed"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">AP credit</p>
              <p className="max-w-48 text-xl font-bold text-slate-800">{ap_credit.length ? ap_credit.join(", ") : "None"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-berkeley to-berkeley-light transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600">
            {Object.values(CATEGORY_STYLES).map((style) => (
              <span key={style.label} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${style.bar}`} />
                {style.label}
              </span>
            ))}
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-berkeley-light disabled:opacity-40"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-berkeley-light"
            >
              {shared === "copied" ? "✓ Link copied" : shared === "failed" ? "Couldn't copy" : "🔗 Share link"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg bg-berkeley px-3 py-1.5 text-xs font-medium text-white transition hover:bg-berkeley-light"
            >
              🖨️ Print / PDF
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-400 print:hidden">
          Drag courses between semesters (or use ⇄ on a phone), × to remove, + to add. Your plan is saved in this browser.
        </p>
      </section>

      {/* Warnings & problems */}
      {(warnings.length > 0 || issues.length > 0) && (
        <div className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
          {issues.map((i) => (
            <p key={`${i.term}-${i.course}-${i.message}`}>
              🚫 <span className="font-medium">{i.term}:</span> {i.message}
            </p>
          ))}
        </div>
      )}

      {Object.entries(grouped).map(([year, semesters]) => (
        <section key={year} className="break-inside-avoid">

          {/* Year Header */}
          <div className="mb-4 flex items-center gap-3">
            <h2 className="rounded-full bg-berkeley px-4 py-1 text-sm font-bold tracking-wide text-white">{year}</h2>
            <div className="h-px flex-1 bg-linear-to-r from-gold/60 to-transparent" />
            <span className="text-sm text-slate-500">
              {semesters.reduce((sum, s) => sum + s.units, 0)} units
            </span>
          </div>

          {/* Semesters */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {semesters.map((semester) => {
              const season = semester.term.split(" ")[2];
              const isSummer = season === "Summer";
              const termIssues = issues.filter((i) => i.term === semester.term && i.course === null);
              const isTarget = dragOver === semester.term;
              const pickerOpen = picker?.term === semester.term;
              const matches = pickerOpen
                ? catalog
                    .filter((c) => !planned.has(c.code))
                    .filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(picker.query.toLowerCase()))
                    .slice(0, 6)
                : [];

              return (
                <div
                  key={semester.term}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(semester.term);
                  }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    move(e.dataTransfer.getData(DRAG_TYPE), semester.term);
                  }}
                  className={`rounded-2xl p-5 shadow-sm transition print:shadow-none ${
                    isSummer ? "bg-sky-50/70 md:col-span-2" : "bg-white"
                  } ${
                    isTarget
                      ? "scale-[1.01] ring-2 ring-gold shadow-lg"
                      : termIssues.length
                        ? "ring-2 ring-red-300"
                        : isSummer
                          ? "border border-dashed border-sky-300"
                          : "ring-1 ring-slate-200 hover:shadow-md"
                  }`}
                >

                  {/* Semester Title */}
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                      <span>{SEASON_ICONS[season]}</span>
                      {season}
                      {isSummer && <span className="text-xs font-normal text-slate-400">optional</span>}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      termIssues.length ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                    }`}>
                      {semester.units} units
                    </span>
                  </div>

                  {/* Courses */}
                  <ul className={`space-y-2 ${isSummer ? "grid gap-2 space-y-0 sm:grid-cols-2" : "min-h-12"}`}>
                    {semester.courses.map((course) => {
                      const style = CATEGORY_STYLES[course.category];
                      const problem = issues.find((i) => i.term === semester.term && i.course === course.code);
                      return (
                        <li
                          key={course.code}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_TYPE, course.code);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          title={problem?.message ?? "Drag to another semester"}
                          className={`group flex cursor-grab items-center gap-3 rounded-xl py-2 pr-2 transition active:cursor-grabbing ${
                            problem ? "bg-red-50 ring-1 ring-red-300" : "bg-slate-50 hover:bg-slate-100"
                          }`}
                        >
                          <span className={`h-9 w-1 rounded-full ${style.bar}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{course.code}</p>
                            <p className={`truncate text-xs ${problem ? "text-red-600" : "text-slate-500"}`}>
                              {problem ? problem.message : course.title}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                            {course.units}u
                          </span>

                          {/* Move to... (works on phones, where dragging doesn't) */}
                          <label className="relative rounded-md px-1 text-slate-400 transition hover:bg-slate-200 hover:text-berkeley sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 print:hidden">
                            <span aria-hidden>⇄</span>
                            <select
                              aria-label={`Move ${course.code} to`}
                              value=""
                              onChange={(e) => move(course.code, e.target.value)}
                              className="absolute inset-0 cursor-pointer opacity-0"
                            >
                              <option value="" disabled>Move to…</option>
                              {plan.filter((s) => s.term !== semester.term).map((s) => (
                                <option key={s.term} value={s.term}>{s.term}</option>
                              ))}
                            </select>
                          </label>

                          <button
                            type="button"
                            onClick={() => move(course.code, null)}
                            aria-label={`Remove ${course.code}`}
                            className="rounded-md px-1.5 text-slate-300 transition hover:bg-red-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 print:hidden"
                          >
                            ×
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {isSummer && semester.courses.length === 0 && (
                    <p className="text-center text-xs text-slate-400">Drag a course here to take it over the summer</p>
                  )}

                  {/* Add course */}
                  <div className="print:hidden">
                    {pickerOpen ? (
                      <div className="mt-3">
                        <input
                          autoFocus
                          value={picker.query}
                          onChange={(e) => setPicker({ term: semester.term, query: e.target.value })}
                          onKeyDown={(e) => e.key === "Escape" && setPicker(null)}
                          placeholder="Search courses, e.g. CS 189"
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-berkeley-light"
                        />
                        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-100">
                          {matches.map((c) => (
                            <li key={c.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  move(c.code, semester.term);
                                  setPicker(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gold/10"
                              >
                                <span className={`h-2 w-2 rounded-full ${CATEGORY_STYLES[c.category].bar}`} />
                                <span className="font-semibold">{c.code}</span>
                                <span className="truncate text-xs text-slate-500">{c.title}</span>
                              </button>
                            </li>
                          ))}
                          {matches.length === 0 && (
                            <li className="px-3 py-2 text-xs text-slate-400">No matching courses left to add</li>
                          )}
                        </ul>
                        <button type="button" onClick={() => setPicker(null)} className="mt-1 text-xs text-slate-400 hover:text-slate-600">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPicker({ term: semester.term, query: "" })}
                        className="mt-3 w-full rounded-xl border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 transition hover:border-gold hover:bg-gold/5 hover:text-berkeley"
                      >
                        + Add course
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

        </section>
      ))}
    </div>
  );
}
