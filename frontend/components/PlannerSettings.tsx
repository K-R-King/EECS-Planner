"use client";

import { useState } from "react";
import type { PlannerSettings as Settings } from "@/lib/api";

interface Props {
  onGenerate: (settings: Settings) => void;
  loading: boolean;
}

export default function PlannerSettings({ onGenerate, loading }: Props) {
  const [timeline, setTimeline] = useState(4);
  const [maxUnits, setMaxUnits] = useState(16);

  const [apCS, setApCS] = useState(false);
  const [apCalcBC, setApCalcBC] = useState(false);
  const [apPhysicsC, setApPhysicsC] = useState(false);

  function handleGenerate() {
    onGenerate({
      timeline,
      maxUnits,
      apCS,
      apCalcBC,
      apPhysicsC,
    });
  }

  return (
    <div className="max-w-3xl mx-auto bg-white shadow rounded-xl p-6 border">
      
      <h2 className="text-xl font-semibold mb-4">
        Planner Settings
      </h2>

      {/* Timeline */}
      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Graduation Timeline
        </label>

        <select
          className="w-full mt-1 border rounded p-2"
          value={timeline}
          onChange={(e) => setTimeline(Number(e.target.value))}
        >
          <option value={4}>4 Years (Standard)</option>
          <option value={3.5}>3.5 Years</option>
          <option value={3}>3 Years (Fast Track)</option>
        </select>
      </div>

      {/* Units */}
      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Max Units Per Semester: {maxUnits}
        </label>

        <input
          type="range"
          min="12"
          max="20"
          value={maxUnits}
          onChange={(e) => setMaxUnits(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* AP Credits */}
      <div className="mb-4">
        <label className="text-sm text-gray-600">
          Incoming AP Credit
        </label>

        <div className="flex flex-col gap-2 mt-2 text-sm">
          <label>
            <input
              type="checkbox"
              checked={apCS}
              onChange={(e) => setApCS(e.target.checked)}
            />{" "}
            AP Computer Science A
          </label>

          <label>
            <input
              type="checkbox"
              checked={apCalcBC}
              onChange={(e) => setApCalcBC(e.target.checked)}
            />{" "}
            AP Calculus BC
          </label>

          <label>
            <input
              type="checkbox"
              checked={apPhysicsC}
              onChange={(e) => setApPhysicsC(e.target.checked)}
            />{" "}
            AP Physics C
          </label>
        </div>
      </div>

      {/* Button */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Generate My {timeline}-Year Plan
      </button>
    </div>
  );
}