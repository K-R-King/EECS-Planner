"use client";

import { useEffect } from "react";
import { takeIncoming, withTaken } from "@/lib/handoff";

// Adds the student's taken courses to every link to a sister EECS site just before it's followed
// (click, middle-click, keyboard or touch), so the next site already knows them. Renders nothing.
export default function SuiteLinks() {
  useEffect(() => {
    takeIncoming();
    const update = (e: Event) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (link instanceof HTMLAnchorElement) link.href = withTaken(link.href);
    };
    document.addEventListener("pointerdown", update, true);
    document.addEventListener("focusin", update, true);
    document.addEventListener("click", update, true);
    return () => {
      document.removeEventListener("pointerdown", update, true);
      document.removeEventListener("focusin", update, true);
      document.removeEventListener("click", update, true);
    };
  }, []);
  return null;
}
