export default function Hero() {
  return (
    <header className="relative overflow-hidden bg-berkeley px-4 pt-16 pb-32 text-center text-white">
      {/* soft background glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-berkeley-light/40 blur-3xl" />

      <div className="relative">
        <span className="inline-block rounded-full border border-gold/40 bg-gold/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-gold">
          For incoming EECS students
        </span>

        <h1 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-6xl">
          UC Berkeley <span className="text-gold">EECS</span> Planner
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-blue-100 sm:text-lg">
          Map out every semester of your degree before you even start college:
          prerequisites, breadth, and electives, all in one roadmap.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-blue-200">
          <span>✓ No signup</span>
          <span>✓ Prerequisite-aware</span>
          <span>✓ AI advisor built in</span>
        </div>
      </div>
    </header>
  );
}
