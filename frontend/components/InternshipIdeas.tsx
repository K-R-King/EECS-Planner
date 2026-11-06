import type { Semester } from "@/lib/api";
import { internshipIdeas } from "@/lib/internships";

/** Internship searches that match the courses in this plan. */
export default function InternshipIdeas({ plan }: { plan: Semester[] }) {
  const ideas = internshipIdeas(plan);
  if (!ideas.length) return null;

  return (
    <section aria-labelledby="internship-ideas" className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
      <h2 id="internship-ideas" className="text-lg font-semibold text-slate-800 dark:text-slate-100">Internships that fit this plan</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ideas.map((idea) => (
          <li key={idea.label}>
            <a
              href={idea.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-full rounded-xl bg-slate-50 p-3 transition hover:bg-slate-100 dark:bg-slate-800/60 dark:hover:bg-slate-800"
            >
              <span className="block font-semibold text-berkeley dark:text-blue-300">{idea.label} {"↗"}</span>
              <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">Because of {idea.because.slice(0, 3).join(", ")}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
