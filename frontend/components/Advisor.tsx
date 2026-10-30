"use client";

import { useState } from "react";
import { askAdvisor, type Semester } from "@/lib/api";

interface Props {
  plan: Semester[];
}

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
    <div className="max-w-5xl mx-auto mt-10 bg-white rounded-xl shadow p-6">

      <h2 className="text-2xl font-bold mb-4">
        🤖 AI Academic Advisor
      </h2>

      <textarea
        className="w-full border rounded-lg p-3"
        rows={4}
        placeholder="Ask anything about your plan..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />

      <button
        onClick={handleAsk}
        disabled={loading}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        Ask Advisor
      </button>

      {loading && (
        <p className="mt-4 text-gray-500">
          Thinking...
        </p>
      )}

      {answer && (
        <div className="mt-6 border rounded-lg p-4 bg-gray-50 whitespace-pre-wrap">
          {answer}
        </div>
      )}

    </div>
  );
}
