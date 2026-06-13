export default function DashboardPage() {
  return (
    <div className="flex min-h-full min-w-0 flex-col gap-6 bg-[#000212] p-4 md:p-6 lg:p-8">
      <header className="grid shrink-0 grid-cols-1 gap-3 rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-3 shadow-[0_18px_40px_rgba(0,0,0,0.5)] md:grid-cols-2 md:gap-4 md:p-4 lg:grid-cols-3 lg:items-center">
        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#ddd7ea]">
            Company logo
          </div>
          <div className="rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[rgba(0,2,18,0.75)] px-3 py-1.5 text-xs font-medium text-[#ddd7ea]">
            Compliance badge
          </div>
        </div>

        <div className="flex justify-center">
          <div className="w-full max-w-xs rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] px-4 py-2 text-center text-sm font-semibold text-[rgba(221,215,234,0.85)] md:max-w-sm">
            ROI $
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 md:justify-end lg:justify-end">
          <div className="flex h-9 w-9 items-center justify-center rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[#000212] text-xs font-medium text-[rgba(221,215,234,0.75)] transition-colors hover:border-[#754cbe]">
            Bell
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[#000212] text-xs font-medium text-[rgba(221,215,234,0.75)] transition-colors hover:border-[#754cbe]">
            Settings
          </div>
          <div className="min-w-[8rem] flex-1 rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[#000212] px-3 py-2 text-xs font-medium text-[rgba(221,215,234,0.5)] md:min-w-[12rem] md:flex-none lg:min-w-[14rem]">
            Search
          </div>
        </div>
      </header>

      <section
        className="grid min-w-0 grid-cols-2 gap-4 md:gap-6"
        aria-label="Dashboard widgets"
      >
        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Risk
          </h2>
          <div className="flex flex-1 items-center justify-center rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] py-12 text-sm font-medium text-[rgba(221,215,234,0.55)]">
            % Circle
          </div>
        </article>

        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Compliance
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-[10px] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-center text-xs font-medium text-[#ddd7ea]">
              <div className="mb-1 font-semibold text-white">PIPEDA</div>
              <div>%</div>
            </div>
            <div className="rounded-[10px] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-center text-xs font-medium text-[#ddd7ea]">
              <div className="mb-1 font-semibold text-white">FIPPA</div>
              <div>%</div>
            </div>
            <div className="rounded-[10px] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-center text-xs font-medium text-[#ddd7ea]">
              <div className="mb-1 font-semibold text-white">HIPAA</div>
              <div>%</div>
            </div>
          </div>
        </article>

        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Alerts
          </h2>
          <div className="flex flex-wrap gap-3">
            <div className="flex min-w-[5rem] flex-1 flex-col items-center rounded-[0.6rem] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-xs font-medium text-[#ddd7ea]">
              <span className="mb-1 text-lg text-white" aria-hidden>
                ▲
              </span>
              High
            </div>
            <div className="flex min-w-[5rem] flex-1 flex-col items-center rounded-[0.6rem] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-xs font-medium text-[#ddd7ea]">
              <span className="mb-1 text-lg text-white" aria-hidden>
                ✓
              </span>
              Low
            </div>
            <div className="flex min-w-[5rem] flex-1 flex-col items-center rounded-[0.6rem] border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)] p-3 text-xs font-medium text-[#ddd7ea]">
              <span className="mb-1 text-lg text-white" aria-hidden>
                !
              </span>
              Medium
            </div>
          </div>
        </article>

        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Action plan
          </h2>
          <ul className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-[10px] border border-[rgba(117,76,190,0.25)] bg-[rgba(0,2,18,0.35)] px-2 py-2 text-xs font-medium text-[rgba(221,215,234,0.65)]"
              >
                <span className="h-4 w-4 shrink-0 rounded-full border border-dashed border-[rgba(117,76,190,0.5)]" />
                <span className="h-2 flex-1 rounded-[4px] bg-[rgba(117,76,190,0.35)]" />
              </li>
            ))}
          </ul>
        </article>

        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Trend graph
          </h2>
          <div className="mb-3 flex min-h-[7rem] flex-1 items-center justify-center rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] text-sm font-medium text-[rgba(221,215,234,0.55)]">
            Line chart placeholder
          </div>
          <div className="h-2 w-full rounded-full border border-[rgba(117,76,190,0.3)] bg-[rgba(0,2,18,0.75)]" />
        </article>

        <article className="flex min-w-0 flex-col rounded-[1.25rem] border border-[rgba(117,76,190,0.35)] bg-[#181430] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.4)] md:p-5">
          <h2 className="mb-3 border-b border-[rgba(221,215,234,0.15)] pb-2 text-sm font-bold uppercase tracking-wide text-white">
            Last assessment
          </h2>
          <ul className="flex flex-col gap-2">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-[10px] border border-[rgba(117,76,190,0.25)] bg-[rgba(0,2,18,0.35)] px-2 py-2 text-xs font-medium text-[rgba(221,215,234,0.65)]"
              >
                <span className="h-4 w-4 shrink-0 rounded-full border border-dashed border-[rgba(117,76,190,0.5)]" />
                <span className="h-2 flex-1 rounded-[4px] bg-[rgba(117,76,190,0.35)]" />
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
