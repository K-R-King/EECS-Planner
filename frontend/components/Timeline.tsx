"use client";

import { useState } from "react";
import { courseDetails, prereqCodes, type CatalogCourse, type PlannerSettings, type PlanResult, type Semester } from "@/lib/api";
import { CATEGORY_STYLES, DRAG_TYPE } from "@/lib/categories";

interface Props {
  result: PlanResult | null;
  catalog: CatalogCourse[];
  onEdit: (plan: Semester[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  onShare: () => Promise<boolean>;
  onFix: (changes: Partial<PlannerSettings>) => void;
  picks: Record<string, string>;
  onPick: (code: string, choice: string | null) => void;
  onPickInto: (code: string, choice: string, plan: Semester[]) => void;  // choose a slot's course and move the slot
}

// a specific course offered as a choice for a placeholder slot (ENGIN 125 for the Ethics slot), found by "+ Add course"
type SlotChoice = { label: string; slot: string | null; slotTitle: string; upperHss: boolean; unitsNote: string };

const compact = (text: string) => text.toLowerCase().replace(/\s+/g, "");

/**
 * Slot choices matching `query`, each with the slot it would fill: one already set to it, else an open slot
 * (Ethics first, since a 3-unit ethics course there also covers an upper-division H/SS course), else any.
 * Generic choices ("Historical Studies course") aren't real courses, so they're left out.
 */
function slotChoices(query: string, catalog: CatalogCourse[], plan: Semester[], picks: Record<string, string>): SlotChoice[] {
  const q = compact(query);
  if (q.length < 2) return [];
  const inPlan = new Set(plan.flatMap((s) => s.courses.map((c) => c.code)));
  const slots = catalog.filter((c) => c.options.length > 0);
  const labels = [...new Set(slots.flatMap((s) => s.options.map((o) => o.label)))]
    .filter((label) => !/ course$/.test(label) && compact(label).includes(q));
  return labels.map((label) => {
    const holders = slots.filter((s) => s.options.some((o) => o.label === label));
    const open = holders.filter((s) => inPlan.has(s.code));
    const target =
      open.find((s) => picks[s.code] === label) ??
      open.filter((s) => !picks[s.code]).sort((a, b) => Number(b.code === "ETHICS") - Number(a.code === "ETHICS"))[0] ??
      open[0] ?? null;
    const option = (target ?? holders[0]).options.find((o) => o.label === label)!;
    return {
      label,
      slot: target?.code ?? null,
      slotTitle: (target ?? holders[0]).title.replace(/\s*\(.*\)$/, ""),
      upperHss: !!option.upper_hss,
      unitsNote: option.units !== undefined ? `${option.units}u` : "",
    };
  });
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

export default function Timeline({ result, catalog, onEdit, onUndo, canUndo, onShare, onFix, picks, onPick, onPickInto }: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ term: string; query: string } | null>(null);
  const [shared, setShared] = useState<"idle" | "copied" | "failed">("idle");
  // the course being hovered, to highlight what it needs and what it unlocks
  const [hovered, setHovered] = useState<string | null>(null);

  if (!result) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
        <div className="hero-grid pointer-events-none absolute inset-0 opacity-40 invert" />
        <div className="relative">
          <div className="mx-auto flex h-16 w-16 animate-float items-center justify-center rounded-2xl bg-berkeley text-3xl shadow-lg shadow-berkeley/30">
            🗺️
          </div>
          <p className="mt-5 text-lg font-semibold text-berkeley dark:text-blue-300">Your roadmap will appear here</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pick your settings above and hit generate. Then drag courses around to make it yours.
          </p>
        </div>
      </div>
    );
  }

  const { plan, total_units, ap_credit, ap_units, upper_eecs_units, warnings, issues } = result;
  const planned = new Set([...ap_credit, ...(result.completed ?? []), ...plan.flatMap((s) => s.courses.map((c) => c.code))]);
  const byCode = new Map(catalog.map((c) => [c.code, c]));
  const hasDesign = plan.some((s) => s.courses.some((c) => byCode.get(c.code)?.design));
  const needs = new Set(hovered ? prereqCodes(byCode.get(hovered)?.prereqs ?? []) : []);
  const unlocks = new Set(hovered ? catalog.filter((c) => prereqCodes(c.prereqs).includes(hovered)).map((c) => c.code) : []);

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
      <section className="rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 print:shadow-none">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Units toward graduation</p>
            <p className="text-3xl font-extrabold text-berkeley dark:text-blue-300">
              {total_units}
              <span className="text-lg font-semibold text-slate-500 dark:text-slate-400"> / {TOTAL_UNITS}</span>
            </p>
            {ap_units > 0 && <p className="text-xs text-slate-500 dark:text-slate-400">includes {ap_units} AP units</p>}
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <p className="text-slate-500 dark:text-slate-400">Upper-div EECS</p>
              <p className={`text-xl font-bold ${upper_eecs_units >= UPPER_EECS_UNITS ? "text-emerald-600" : "text-amber-600"}`}>
                {upper_eecs_units}/{UPPER_EECS_UNITS} {upper_eecs_units >= UPPER_EECS_UNITS && "✓"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">Design course</p>
              <p className={`text-xl font-bold ${hasDesign ? "text-emerald-600" : "text-amber-600"}`}>
                {hasDesign ? "✓ Yes" : "Needed"}
              </p>
            </div>
            <div>
              <p className="text-slate-500 dark:text-slate-400">AP credit</p>
              <p className="max-w-48 text-xl font-bold text-slate-800 dark:text-slate-100">{ap_credit.length ? ap_credit.join(", ") : "None"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-linear-to-r from-berkeley to-berkeley-light transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-300">
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
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-berkeley-light disabled:opacity-40"
            >
              ↶ Undo
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 transition hover:border-berkeley-light"
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

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 print:hidden">
          Drag courses between semesters (or use ⇄ on a phone), × to remove, + to add. Hover or tap a course to see what it{" "}
          <span className="font-semibold text-sky-700 dark:text-sky-300">needs first</span> and what it{" "}
          <span className="font-semibold text-amber-800 dark:text-gold">unlocks</span>. Your plan is saved in this browser.
        </p>
      </section>

      {/* Warnings & problems */}
      {(warnings.length > 0 || issues.length > 0) && (
        <div className="space-y-1.5 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-4 text-sm text-amber-800 dark:text-amber-200">
          {warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
          {result.fixes && result.fixes.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 print:hidden">
              <span className="font-medium">Ways to fit everything in:</span>
              {result.fixes.map((fix) => (
                <button
                  key={fix.label}
                  type="button"
                  onClick={() => onFix(fix.settings)}
                  className="rounded-full border border-amber-400 bg-white px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100"
                >
                  {fix.label}
                </button>
              ))}
            </div>
          )}
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
            <span className="text-sm text-slate-600 dark:text-slate-400">
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
              // codes match with or without spaces ("CS 189"), titles as typed
              const matches = pickerOpen
                ? catalog
                    .filter((c) => !planned.has(c.code))
                    .filter((c) => compact(c.code).includes(compact(picker.query)) || c.title.toLowerCase().includes(picker.query.trim().toLowerCase()))
                    .slice(0, 6)
                : [];
              const choices = pickerOpen ? slotChoices(picker.query, catalog, plan, picks).slice(0, 4) : [];

              return (
                <div
                  key={semester.term}
                  data-term={semester.term}
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
                    isSummer ? "bg-sky-50/70 dark:bg-sky-950/30 md:col-span-2" : "bg-white dark:bg-slate-900"
                  } ${
                    isTarget
                      ? "scale-[1.01] ring-2 ring-gold shadow-lg"
                      : termIssues.length
                        ? "ring-2 ring-red-300"
                        : isSummer
                          ? "border border-dashed border-sky-300"
                          : "ring-1 ring-slate-200 dark:ring-slate-700 hover:shadow-md"
                  }`}
                >

                  {/* Semester Title */}
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-100">
                      <span>{SEASON_ICONS[season]}</span>
                      {season}
                      {isSummer && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">optional</span>}
                    </h3>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      termIssues.length ? "bg-red-100 text-red-700" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}>
                      {semester.units} units
                    </span>
                  </div>

                  {/* Courses */}
                  <ul className={`space-y-2 ${isSummer ? "grid gap-2 space-y-0 sm:grid-cols-2" : "min-h-12"}`}>
                    {semester.courses.map((course) => {
                      const style = CATEGORY_STYLES[course.category];
                      const problem = issues.find((i) => i.term === semester.term && i.course === course.code);
                      const options = byCode.get(course.code)?.options ?? [];
                      const relation = needs.has(course.code) ? "needs" : unlocks.has(course.code) ? "unlocks" : null;
                      return (
                        <li
                          key={course.code}
                          data-course={course.code}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData(DRAG_TYPE, course.code);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onMouseEnter={() => setHovered(course.code)}
                          onMouseLeave={() => setHovered(null)}
                          tabIndex={0}
                          onFocus={() => setHovered(course.code)}
                          onBlur={() => setHovered(null)}
                          title={problem?.message ?? (courseDetails(byCode.get(course.code)) || "Drag to another semester")}
                          className={`group flex cursor-grab items-center gap-3 rounded-xl py-2 pr-2 transition active:cursor-grabbing ${
                            problem ? "bg-red-50 dark:bg-red-950/40 ring-1 ring-red-300" : "bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800"
                          } ${relation === "needs" ? "ring-2 ring-sky-400" : relation === "unlocks" ? "ring-2 ring-gold" : ""}`}
                        >
                          <span className={`h-9 w-1 rounded-full ${style.bar}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                              {course.code}
                              {relation && (
                                <span className={`ml-2 text-[10px] font-bold uppercase ${relation === "needs" ? "text-sky-700 dark:text-sky-300" : "text-amber-800 dark:text-gold"}`}>
                                  {relation === "needs" ? "needed first" : "unlocks"}
                                </span>
                              )}
                            </p>
                            {problem ? (
                              <p className="truncate text-xs text-red-600 dark:text-red-300">{problem.message}</p>
                            ) : options.length > 0 ? (
                              <select
                                value={picks[course.code] ?? ""}
                                onChange={(e) => onPick(course.code, e.target.value || null)}
                                aria-label={`Choose a course for ${course.title}`}
                                className="w-full max-w-full truncate rounded bg-transparent text-xs text-slate-500 dark:text-slate-400 outline-none hover:text-berkeley print:appearance-none"
                              >
                                <option value="">{course.title}: choose a course…</option>
                                {options.map((o) => (
                                  <option key={o.label} value={o.label}>
                                    {o.label}{o.units !== undefined && ` (${o.units}u)`}{o.upper_hss && " · also upper-div H/SS"}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{course.title}</p>
                            )}
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                            {style.short} {course.units}u
                          </span>

                          {/* Move to... (works on phones, where dragging doesn't) */}
                          <label className="relative rounded-md px-1 text-slate-500 dark:text-slate-400 transition hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-berkeley sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 print:hidden">
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
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">Drag a course here to take it over the summer</p>
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
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-berkeley-light"
                        />
                        <ul tabIndex={0} aria-label="Matching courses" className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-100 dark:border-slate-800">
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
                                <span className="truncate text-xs text-slate-500 dark:text-slate-400">{c.title}</span>
                              </button>
                            </li>
                          ))}
                          {choices.map((choice) => (
                            <li key={choice.label}>
                              <button
                                type="button"
                                disabled={!choice.slot}
                                onClick={() => {
                                  if (!choice.slot) return;
                                  onPickInto(choice.slot, choice.label, placeCourse(plan, catalog, choice.slot, semester.term));
                                  setPicker(null);
                                }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <span className="h-2 w-2 shrink-0 self-start rounded-full bg-slate-400 mt-1.5" />
                                {/* two lines: the semester columns are too narrow for the explanation beside the name */}
                                <span className="min-w-0">
                                  <span className="block font-semibold">{choice.label}</span>
                                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                                    {choice.slot
                                      ? `fills your ${choice.slotTitle} slot${choice.upperHss ? " · also upper-div H/SS" : ""}${choice.unitsNote && ` · ${choice.unitsNote}`}`
                                      : `a choice for ${choice.slotTitle}, which isn't in your plan`}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                          {matches.length === 0 && choices.length === 0 && (
                            <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">No matching courses left to add</li>
                          )}
                        </ul>
                        <button type="button" onClick={() => setPicker(null)} className="mt-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPicker({ term: semester.term, query: "" })}
                        className="mt-3 w-full rounded-xl border border-dashed border-slate-300 dark:border-slate-600 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 transition hover:border-gold hover:bg-gold/5 hover:text-berkeley"
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
