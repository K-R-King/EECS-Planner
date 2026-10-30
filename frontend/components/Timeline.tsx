"use client";

import type { Category, PlanResult, Semester } from "@/lib/api";

interface Props {
  result: PlanResult | null;
}

const TOTAL_UNITS = 120;

const CATEGORY_STYLES: Record<Category, { label: string; bar: string; chip: string }> = {
  core: { label: "Core", bar: "bg-berkeley", chip: "bg-berkeley/10 text-berkeley" },
  elective: { label: "Upper-div elective", bar: "bg-gold", chip: "bg-gold/20 text-gold-dark" },
  hss: { label: "Breadth / R&C", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  ethics: { label: "Ethics", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-700" },
};

export default function Timeline({ result }: Props) {
  if (!result) {
    return (
      <div className="mx-auto mt-12 max-w-5xl rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center text-slate-500">
        <p className="text-4xl">🗺️</p>
        <p className="mt-3 font-medium">Your roadmap will appear here</p>
        <p className="text-sm">Pick your settings above and hit generate.</p>
      </div>
    );
  }

  const { plan, total_units, ap_credit, warnings } = result;

  // Group semesters by year label ("Year 1 Fall" -> "Year 1")
  const grouped: Record<string, Semester[]> = {};

  plan.forEach((semester) => {
    const year = semester.term.split(" ").slice(0, 2).join(" ");
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(semester);
  });

  const progress = Math.min(100, Math.round((total_units / TOTAL_UNITS) * 100));

  return (
    <div className="mx-auto mt-12 max-w-5xl space-y-10">

      {/* Summary */}
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Units toward graduation</p>
            <p className="text-3xl font-extrabold text-berkeley">
              {total_units}
              <span className="text-lg font-semibold text-slate-400"> / {TOTAL_UNITS}</span>
            </p>
          </div>
          <div className="flex gap-6 text-sm">
            <div>
              <p className="text-slate-500">Semesters</p>
              <p className="text-xl font-bold text-slate-800">{plan.length}</p>
            </div>
            <div>
              <p className="text-slate-500">AP credit</p>
              <p className="text-xl font-bold text-slate-800">{ap_credit.length ? ap_credit.join(", ") : "None"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-berkeley to-berkeley-light transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600">
          {Object.values(CATEGORY_STYLES).map((style) => (
            <span key={style.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${style.bar}`} />
              {style.label}
            </span>
          ))}
        </div>
      </section>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {warnings.map((w) => (
            <p key={w}>⚠️ {w}</p>
          ))}
        </div>
      )}

      {Object.entries(grouped).map(([year, semesters]) => (
        <section key={year}>

          {/* Year Header */}
          <div className="mb-4 flex items-center gap-3">
            <h2 className="text-2xl font-bold text-berkeley">{year}</h2>
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-sm text-slate-500">
              {semesters.reduce((sum, s) => sum + s.units, 0)} units
            </span>
          </div>

          {/* Semesters */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {semesters.map((semester) => {
              const season = semester.term.split(" ")[2];

              return (
                <div
                  key={semester.term}
                  className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md"
                >

                  {/* Semester Title */}
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                      <span>{season === "Fall" ? "🍂" : "🌱"}</span>
                      {season}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {semester.units} units
                    </span>
                  </div>

                  {/* Courses */}
                  <ul className="space-y-2">
                    {semester.courses.map((course) => {
                      const style = CATEGORY_STYLES[course.category];
                      return (
                        <li
                          key={course.code}
                          className="flex items-center gap-3 rounded-xl bg-slate-50 py-2 pr-3"
                        >
                          <span className={`h-9 w-1 rounded-full ${style.bar}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-slate-800">{course.code}</p>
                            <p className="truncate text-xs text-slate-500">{course.title}</p>
                          </div>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                            {course.units}u
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

        </section>
      ))}
    </div>
  );
}
