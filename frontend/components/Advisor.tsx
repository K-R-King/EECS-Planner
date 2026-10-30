"use client";

import { useEffect, useRef, useState } from "react";
import { askAdvisor, type ChatMessage, type PlannerSettings, type PlanResult, type Semester } from "@/lib/api";

interface Props {
  plan: Semester[];
  settings: PlannerSettings;
  onPlanChange: (result: PlanResult) => void;
  onUndo: () => void;
}

interface Message extends ChatMessage {
  changes?: string[];
  skipped?: string[];
  retry?: string;  // set on error messages: the question to ask again
}

const SUGGESTIONS = [
  "Make my plan easier",
  "Move CS 70 to my second year",
  "Add CS 182 somewhere",
  "Which semester looks the hardest?",
];

export default function Advisor({ plan, settings, onPlanChange, onUndo }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, loading]);

  async function ask(text: string) {
    if (!text.trim() || loading) return;

    // error replies aren't real conversation, so don't send them back to the advisor
    const history = messages.filter((m) => !m.retry).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "student", text }]);
    setQuestion("");
    setLoading(true);

    try {
      const reply = await askAdvisor(plan, text, settings, history);
      if (reply.result) onPlanChange(reply.result);
      setMessages((m) => [
        ...m,
        reply.error
          ? { role: "advisor", text: reply.answer, retry: text }
          : { role: "advisor", text: reply.answer, changes: reply.changes, skipped: reply.skipped },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "advisor", text: "Couldn't reach the planner server. Make sure the backend is running, then try again.", retry: text },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const lastChangeIndex = messages.findLastIndex((m) => m.changes?.length);

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-berkeley/10 ring-1 ring-slate-200">

      <div className="relative overflow-hidden bg-linear-to-r from-berkeley-dark via-berkeley to-berkeley-light px-6 py-5 text-white">
        <div className="pointer-events-none absolute -top-10 right-10 h-32 w-32 rounded-full bg-gold/30 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-2xl shadow-lg">🤖</span>
          <div>
            <h2 className="text-lg font-bold">AI Academic Advisor</h2>
            <p className="text-xs text-blue-100">Ask a question, or ask it to change your plan. It edits the roadmap for you.</p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div className="max-h-[28rem] space-y-4 overflow-y-auto bg-slate-50/60 p-6">
        {messages.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">
            Try one of these to get started 👇
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "student"
                  ? "rounded-br-sm bg-berkeley text-white"
                  : m.retry
                    ? "rounded-bl-sm border border-amber-200 bg-amber-50 text-amber-900"
                    : "rounded-bl-sm border border-slate-200 bg-white text-slate-700 shadow-sm"
              }`}
            >
              {m.retry && "⏳ "}
              {m.text}

              {m.retry && i === messages.length - 1 && (
                <button
                  type="button"
                  onClick={() => ask(m.retry!)}
                  disabled={loading}
                  className="mt-2 block rounded-lg bg-amber-200/70 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-200 disabled:opacity-50"
                >
                  ↻ Try again
                </button>
              )}

              {m.changes && m.changes.length > 0 && (
                <div className="mt-3 rounded-xl border border-gold/50 bg-gold/10 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold-dark">Plan updated</p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {m.changes.map((c) => <li key={c}>✓ {c}</li>)}
                    {m.skipped?.map((s) => <li key={s} className="text-slate-400">✗ Skipped: {s}</li>)}
                  </ul>
                  {i === lastChangeIndex && (
                    <button
                      type="button"
                      onClick={onUndo}
                      className="mt-2 text-xs font-semibold text-berkeley underline-offset-2 hover:underline"
                    >
                      ↶ Undo
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-1.5 px-2">
            {[0, 150, 300].map((d) => (
              <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-berkeley-light" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-gold hover:bg-gold/10 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-berkeley-light focus:ring-2 focus:ring-berkeley-light/20"
            placeholder="e.g. Make Year 1 lighter"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-berkeley shadow-sm transition hover:bg-gold-dark hover:text-white disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

    </section>
  );
}
