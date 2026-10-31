"use client";

import { useEffect, useRef, useState } from "react";
import { streamAdvisor, type ChatMessage, type PlannerSettings, type PlanResult, type Semester } from "@/lib/api";

interface Props {
  plan: Semester[];
  settings: PlannerSettings;
  onAccept: (result: PlanResult) => void;
  onUndo: () => void;
}

interface Message extends ChatMessage {
  changes?: string[];
  skipped?: string[];
  proposal?: PlanResult;                         // the plan with the advisor's edits, waiting for the student
  basePlan?: Semester[];                         // the plan the proposal was made from
  status?: "pending" | "accepted" | "rejected";
  retry?: string;                                // set on error messages: the question to ask again
}

const SUGGESTIONS = [
  "Make my plan easier",
  "Move CS 70 to my second year",
  "Add CS 182 somewhere",
  "Which semester looks the hardest?",
];

export default function Advisor({ plan, settings, onAccept, onUndo }: Props) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const conversation = useRef<HTMLDivElement>(null);

  // keep the newest message in view, scrolling only the chat box (never the whole page)
  useEffect(() => {
    const box = conversation.current;
    if (box && messages.length > 0) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function updateLast(changes: Partial<Message>) {
    setMessages((m) => [...m.slice(0, -1), { ...m[m.length - 1], ...changes }]);
  }

  function setStatus(index: number, status: Message["status"]) {
    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, status } : msg)));
  }

  async function ask(text: string) {
    if (!text.trim() || loading) return;

    // error replies aren't real conversation, so don't send them back to the advisor
    const history = messages.filter((m) => !m.retry).map(({ role, text }) => ({ role, text }));
    const askedAbout = plan;
    setMessages((m) => [...m, { role: "student", text }, { role: "advisor", text: "" }]);
    setQuestion("");
    setLoading(true);

    try {
      let streamed = "";
      const reply = await streamAdvisor(
        plan, text, settings, history,
        (piece) => {
          streamed += piece;
          updateLast({ text: streamed });
        },
        (status) => updateLast({ text: `${streamed}

⏳ ${status}` }),
      );
      updateLast(
        reply.error
          ? { text: reply.answer, retry: text }
          : {
              text: reply.answer,
              changes: reply.changes,
              skipped: reply.skipped,
              proposal: reply.result ?? undefined,
              basePlan: askedAbout,
              status: reply.result ? "pending" : undefined,
            },
      );
    } catch {
      updateLast({ text: "Couldn't reach the planner server. Make sure the backend is running, then try again.", retry: text });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-3xl bg-white dark:bg-slate-900 shadow-xl shadow-berkeley/10 ring-1 ring-slate-200 dark:ring-slate-700">

      <div className="relative overflow-hidden bg-linear-to-r from-berkeley-dark via-berkeley to-berkeley-light px-6 py-5 text-white">
        <div className="pointer-events-none absolute -top-10 right-10 h-32 w-32 rounded-full bg-gold/30 blur-2xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold text-2xl shadow-lg" aria-hidden>🤖</span>
          <div>
            <h2 className="text-lg font-bold">AI Academic Advisor</h2>
            <p className="text-xs text-blue-100">Ask a question, or ask it to change your plan. You approve every change.</p>
            <p className="mt-0.5 text-[11px] text-blue-200/80">Your question and plan are sent to Google Gemini to answer.</p>
          </div>
        </div>
      </div>

      {/* Conversation */}
      <div ref={conversation} tabIndex={0} aria-label="Conversation with the advisor" className="max-h-[28rem] space-y-4 overflow-y-auto bg-slate-50/60 dark:bg-slate-950/40 p-6" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Try one of these to get started 👇
          </p>
        )}

        {messages.map((m, i) => {
          const stale = m.status === "pending" && m.basePlan !== plan;
          return (
            <div key={i} className={`flex ${m.role === "student" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "student"
                    ? "rounded-br-sm bg-berkeley text-white"
                    : m.retry
                      ? "rounded-bl-sm border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100"
                      : "rounded-bl-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-sm"
                }`}
              >
                {m.retry && "⏳ "}
                {m.text || (loading && i === messages.length - 1 && (
                  <span className="flex gap-1.5 py-1" aria-label="The advisor is thinking">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-berkeley-light" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                ))}

                {m.retry && i === messages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => ask(m.retry!)}
                    disabled={loading}
                    className="mt-2 block rounded-lg bg-amber-200/70 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100 transition hover:bg-amber-200 disabled:opacity-50"
                  >
                    ↻ Try again
                  </button>
                )}

                {m.changes && m.changes.length > 0 && (
                  <div className="mt-3 rounded-xl border border-gold/50 bg-gold/10 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-gold">
                      {m.status === "accepted" ? "Plan updated" : m.status === "rejected" ? "Not applied" : "Suggested changes"}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700 dark:text-slate-200">
                      {m.changes.map((c) => <li key={c}>{m.status === "rejected" ? "✗" : "✓"} {c}</li>)}
                      {m.skipped?.map((s) => <li key={s} className="text-slate-500 dark:text-slate-400">✗ Skipped: {s}</li>)}
                    </ul>
                    {m.proposal && m.proposal.issues.length > 0 && m.status === "pending" && (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-300">⚠️ This would leave {m.proposal.issues.length} problem(s) in your plan.</p>
                    )}

                    {m.status === "pending" && (stale ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Your plan changed since this suggestion. Ask again for an up-to-date one.</p>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onAccept(m.proposal!);
                            setStatus(i, "accepted");
                          }}
                          className="rounded-lg bg-berkeley px-3 py-1 text-xs font-semibold text-white transition hover:bg-berkeley-light"
                        >
                          ✓ Apply changes
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(i, "rejected")}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          Keep my plan
                        </button>
                      </div>
                    ))}
                    {m.status === "accepted" && (
                      <button
                        type="button"
                        onClick={() => {
                          onUndo();
                          setStatus(i, "rejected");
                        }}
                        className="mt-2 text-xs font-semibold text-berkeley dark:text-blue-300 underline-offset-2 hover:underline"
                      >
                        ↶ Undo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 dark:border-slate-800 p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={loading}
              className="rounded-full border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs text-slate-600 dark:text-slate-300 transition hover:border-gold hover:bg-gold/10 disabled:opacity-50"
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
            className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm outline-none transition focus:border-berkeley-light focus:ring-2 focus:ring-berkeley-light/20"
            placeholder="e.g. Make Year 1 lighter"
            aria-label="Ask the advisor"
            maxLength={1000}
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
