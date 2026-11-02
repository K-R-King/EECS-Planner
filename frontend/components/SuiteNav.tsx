import { SUITE, type SiteId } from "@/lib/suite";

// switches between the Planner, Prereqs, Electives and Links sites; the same component lives in all four sites
export default function SuiteNav({ current }: { current: SiteId }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1 backdrop-blur" aria-label="EECS student tools">
      {SUITE.map((s) =>
        s.id === current ? (
          <span key={s.id} aria-current="page" className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-berkeley shadow-md shadow-gold/30">
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </span>
        ) : (
          <a key={s.id} href={s.url} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-blue-100 transition hover:bg-white/10 hover:text-gold">
            <span aria-hidden>{s.icon}</span>
            {s.label}
          </a>
        ),
      )}
    </div>
  );
}
