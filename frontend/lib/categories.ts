import type { Category } from "@/lib/api";

export const CATEGORY_STYLES: Record<Category, { label: string; bar: string; chip: string }> = {
  core: { label: "Core", bar: "bg-berkeley", chip: "bg-berkeley/10 text-berkeley" },
  elective: { label: "Upper-div elective", bar: "bg-gold", chip: "bg-gold/20 text-gold-dark" },
  hss: { label: "Breadth / R&C", bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700" },
  ethics: { label: "Ethics", bar: "bg-violet-500", chip: "bg-violet-100 text-violet-700" },
};

// drag-and-drop payload key
export const DRAG_TYPE = "text/plain";
