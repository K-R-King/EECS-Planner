"use client";

import { useState } from "react";
import { courseDetails, type CatalogCourse, type Category, type PlanResult } from "@/lib/api";
import { CATEGORY_STYLES, DRAG_TYPE } from "@/lib/categories";
import { prereqChainUrl } from "@/lib/suite";

interface Props {
  catalog: CatalogCourse[];
  result: PlanResult;
  onRemove: (code: string) => void;
}

export default function CourseCatalog({ catalog, result, onRemove }: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");
  const [dragOver, setDragOver] = useState(false);
  // on phones the catalog starts collapsed: dragging doesn't work there, and "+ Add course" does the same job
  const [open, setOpen] = useState(false);

  const planned = new Set([...result.ap_credit, ...(result.completed ?? []), ...result.plan.flatMap((s) => s.courses.map((c) => c.code))]);
  const available = catalog
    .filter((c) => !planned.has(c.code))
    .filter((c) => category === "all" || c.category === category)
    .filter((c) => `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()));

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onRemove(e.dataTransfer.getData(DRAG_TYPE));
      }}
      className={`overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-sm transition lg:sticky lg:top-6 ${
        dragOver ? "ring-2 ring-red-300" : "ring-1 ring-slate-200 dark:ring-slate-700"
      }`}
    >
      <div className="flex items-center justify-between bg-linear-to-r from-berkeley to-berkeley-light px-5 py-4 text-white">
        <div>
          <h2 className="font-bold">Course catalog</h2>
          <p className="text-xs text-blue-100">
            {dragOver ? "Drop here to remove from your plan" : "Drag a course into any semester"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="rounded-full border border-white/30 px-3 py-1 text-xs lg:hidden"
        >
          {open ? "Hide ▲" : "Show ▼"}
        </button>
      </div>

      <div className={`space-y-3 p-4 lg:block ${open ? "block" : "hidden"}`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by code or name..."
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-berkeley-light focus:ring-2 focus:ring-berkeley-light/20"
        />

        <div className="flex flex-wrap gap-1.5">
          {(["all", "core", "elective", "hss", "ethics"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`rounded-full px-2.5 py-1 text-xs transition ${
                category === cat ? "bg-berkeley text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cat === "all" ? "All" : CATEGORY_STYLES[cat].label}
            </button>
          ))}
        </div>

        <ul tabIndex={0} aria-label="Courses you can add" className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
          {available.map((c) => (
            <li
              key={c.code}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, c.code);
                e.dataTransfer.effectAllowed = "move";
              }}
              title={courseDetails(c) || "No prerequisites"}
              className="flex cursor-grab items-center gap-2.5 rounded-lg border border-slate-100 dark:border-slate-800 px-2.5 py-2 transition hover:border-gold hover:bg-gold/5 active:cursor-grabbing"
            >
              <span className={`h-7 w-1 rounded-full ${CATEGORY_STYLES[c.category].bar}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{c.code}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{c.title}</p>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{c.units}u</span>
              {prereqChainUrl(c.code) && (
                <a
                  href={prereqChainUrl(c.code)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="See its full prerequisite chain"
                  aria-label={`See the full prerequisite chain for ${c.code}`}
                  className="rounded-md px-1 text-sm transition hover:bg-gold/15"
                >
                  🧭
                </a>
              )}
            </li>
          ))}
          {available.length === 0 && (
            <li className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">Every matching course is already in your plan</li>
          )}
        </ul>
      </div>
    </aside>
  );
}
