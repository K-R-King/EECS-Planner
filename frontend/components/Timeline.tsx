"use client";

import type { Semester } from "@/lib/api";

interface Props {
  plan: Semester[];
}

export default function Timeline({ plan }: Props) {
  if (!plan || plan.length === 0) {
    return (
      <div className="text-center text-gray-500 mt-10">
        Generate a plan to see your roadmap
      </div>
    );
  }

  // Group semesters by year label ("Year 1 Fall" -> "Year 1")
  const grouped: Record<string, Semester[]> = {};

  plan.forEach((semester) => {
    const year = semester.term.split(" ").slice(0, 2).join(" ");
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push(semester);
  });

  return (
    <div className="max-w-5xl mx-auto mt-10 space-y-10">
      {Object.entries(grouped).map(([year, semesters]) => (
        <div key={year}>
          
          {/* Year Header */}
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            {year}
          </h2>

          {/* Semesters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {semesters.map((semester) => (
              <div
                key={semester.term}
                className="bg-white border shadow rounded-xl p-4"
              >
                
                {/* Semester Title */}
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-semibold text-lg">
                    {semester.term.split(" ")[2]}
                  </h3>

                  <span className="text-sm text-gray-500">
                    {semester.units} units
                  </span>
                </div>

                {/* Courses */}
                <div className="flex flex-wrap gap-2">
                  {semester.courses.map((course) => (
                    <span
                      key={course}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      {course}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

        </div>
      ))}
    </div>
  );
}