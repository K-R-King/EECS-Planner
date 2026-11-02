import SuiteNav from "@/components/SuiteNav";

const FLOATING_COURSES = [
  { code: "CS 61A", className: "left-[6%] top-[22%] -rotate-6 animate-float" },
  { code: "CS 70", className: "left-[14%] bottom-[18%] rotate-3 animate-float-slow" },
  { code: "ELENG 66", className: "right-[8%] top-[18%] rotate-6 animate-float-slow" },
  { code: "CS 189", className: "right-[4%] bottom-[24%] -rotate-3 animate-float" },
];

const PREVIEW_YEARS = [
  { year: "Year 1", courses: ["CS 61A", "Math 51", "R&C A"] },
  { year: "Year 2", courses: ["CS 61C", "Math 54", "ELENG 66"] },
  { year: "Year 3", courses: ["CS 162", "CS 188", "CS 189"] },
  { year: "Year 4", courses: ["CS 161", "EECS 151", "🎓"] },
];

const STATS = [
  { value: "120", label: "units planned" },
  { value: "8", label: "semesters mapped" },
  { value: "Every", label: "AP exam supported" },
  { value: "AI", label: "advisor built in" },
];

export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-linear-to-br from-berkeley-dark via-berkeley to-[#0b4a7a] px-4 pb-36 text-white print:hidden">
      {/* background: grid + moving glows + floating course tags */}
      <div className="hero-grid pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 animate-aurora rounded-full bg-gold/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-112 w-md animate-aurora rounded-full bg-berkeley-light/40 blur-3xl [animation-delay:-7s]" />

      {FLOATING_COURSES.map((c) => (
        <span
          key={c.code}
          className={`pointer-events-none absolute hidden rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs text-blue-100/70 backdrop-blur-sm xl:block ${c.className}`}
        >
          {c.code}
        </span>
      ))}

      {/* nav */}
      <nav className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 py-6">
        <div className="flex items-center gap-2 font-bold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          EECS Planner
        </div>
        <SuiteNav current="planner" />
      </nav>

      <div className="relative mx-auto mt-8 grid max-w-6xl items-center gap-12 lg:mt-14 lg:grid-cols-[1.15fr_1fr]">

        {/* pitch */}
        <div className="animate-fade-up text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
            For incoming UC Berkeley students
          </span>

          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Your entire{" "}
            <span className="animate-shimmer bg-linear-to-r from-gold via-amber-200 to-gold bg-size-[200%_auto] bg-clip-text text-transparent">
              EECS degree
            </span>
            , mapped in seconds.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-base text-blue-100/90 sm:text-lg lg:mx-0">
            Pick your timeline and AP credit. Get a semester-by-semester roadmap
            that respects every prerequisite, then ask the AI advisor anything about it.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
            <a
              href="#settings"
              className="rounded-xl bg-gold px-6 py-3 font-semibold text-berkeley shadow-lg shadow-gold/30 transition hover:-translate-y-0.5 hover:shadow-xl"
            >
              Build my roadmap ↓
            </a>
            <span className="flex items-center gap-4 px-2 text-sm text-blue-200">
              <span>✓ No signup</span>
              <span>✓ Free</span>
            </span>
          </div>
        </div>

        {/* animated roadmap preview */}
        <div className="relative mx-auto hidden w-full max-w-md animate-fade-up [animation-delay:200ms] sm:block">
          <div className="absolute -inset-4 rounded-4xl bg-gold/10 blur-2xl" />
          <div className="relative rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
            <div className="mb-5 flex items-center justify-between text-xs text-blue-100">
              <span className="font-semibold uppercase tracking-wider">Your roadmap</span>
              <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-emerald-300">● on track</span>
            </div>

            <div className="relative space-y-5">
              {/* gold path connecting the years */}
              <svg className="absolute top-3 left-2.75 h-[calc(100%-1.5rem)] w-1" preserveAspectRatio="none" viewBox="0 0 2 100">
                <line
                  x1="1" y1="0" x2="1" y2="100"
                  stroke="#FDB515" strokeWidth="2"
                  strokeDasharray="100" strokeDashoffset="100"
                  className="animate-draw"
                />
              </svg>

              {PREVIEW_YEARS.map((y, i) => (
                <div
                  key={y.year}
                  className="relative flex animate-fade-up items-start gap-4"
                  style={{ animationDelay: `${400 + i * 250}ms` }}
                >
                  <span className="relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-berkeley ring-4 ring-berkeley">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{y.year}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {y.courses.map((c) => (
                        <span key={c} className="rounded-md bg-white/15 px-2 py-0.5 text-xs text-blue-50">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <dl className="relative mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-berkeley-dark/40 px-4 py-4 text-center">
            <dt className="text-2xl font-extrabold text-gold">{s.value}</dt>
            <dd className="text-xs text-blue-200">{s.label}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
