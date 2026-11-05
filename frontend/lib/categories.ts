import type { Category } from "@/lib/api";

// `short` labels the type in text too, so it never depends on color alone
export const CATEGORY_STYLES: Record<Category, { label: string; short: string; bar: string; chip: string }> = {
  core: { label: "Core", short: "Core", bar: "bg-berkeley dark:bg-blue-400", chip: "bg-berkeley/10 text-berkeley dark:bg-blue-400/15 dark:text-blue-300" },
  elective: { label: "Upper-div elective", short: "Elec", bar: "bg-gold", chip: "bg-gold/20 text-amber-800 dark:text-gold" },
  hss: { label: "Breadth / R&C", short: "H/SS", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300" },
  ethics: { label: "Ethics", short: "Ethics", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300" },
  extra: { label: "Extra (units only)", short: "Extra", bar: "bg-slate-400", chip: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
};

// drag-and-drop payload key
export const DRAG_TYPE = "text/plain";
