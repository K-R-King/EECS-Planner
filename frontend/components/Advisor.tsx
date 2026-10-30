"use client";

import { useState } from "react";
import { askAdvisor, type Semester } from "@/lib/api";

interface Props {
  plan: Semester[];
}

const SUGGESTIONS = [
  "Which semester looks the hardest?",
  "When should I take CS 170?",
  "Is my first year a reasonable load?",
];

export default function Advisor({ plan }: Props) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!question.trim()) return;

    setLoading(true);

    try {
      setAnswer(await askAdvisor(plan, question));
    } catch {
      setAnswer("Unable to contact AI advisor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">

      <div className="flex items-center gap-3 bg-berkeley px-6 py-4 text-white">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold text-xl">🤖</span>
        <div>
          <h2 className="text-lg font-bold">AI Academic Advisor</h2>
          <p className="text-xs text-blue-200">Ask anything about the plan above</p>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setQuestion(s)}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-gold hover:bg-gold/10"
            >
              {s}
            </button>
          ))}
        </div>

        <textarea
          className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none transition focus:border-berkeley-light focus:ring-2 focus:ring-berkeley-light/20"
          rows={3}
          placeholder="Ask anything about your plan..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />

        <button
          onClick={handleAsk}
          disabled={loading}
          className="mt-3 rounded-xl bg-berkeley px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-berkeley-light disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Ask Advisor"}
        </button>

        {answer && (
          <div className="mt-6 whitespace-pre-wrap rounded-xl border-l-4 border-gold bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
            {answer}
          </div>
        )}
      </div>

    </section>
  );
}
