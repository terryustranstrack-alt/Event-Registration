/** Small dependency-free bar chart with an accessible data table. */
export function BarChart({ title, data, emptyLabel }: { title: string; data: { label: string; count: number }[]; emptyLabel: string }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure className="card">
      <figcaption className="mb-4 font-extrabold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="text-sm text-ink-700">{emptyLabel}</p>
      ) : (
        <>
          <div className="flex h-40 items-end gap-1 overflow-x-auto" aria-hidden="true">
            {data.map((d) => (
              <div key={d.label} className="flex h-full min-w-6 flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.count}`}>
                <span className="text-[11px] font-bold tabular-nums text-ink-700">{d.count || ""}</span>
                <div className="w-full rounded-t-lg bg-linear-to-t from-brand-600 to-pop-500" style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1 overflow-x-auto text-[10px] font-semibold text-ink-700/70" aria-hidden="true">
            {data.map((d, i) => (
              <span key={d.label} className="min-w-6 flex-1 truncate text-center">{i % Math.ceil(data.length / 8) === 0 ? d.label : ""}</span>
            ))}
          </div>
          <table className="sr-only">
            <caption>{title}</caption>
            <tbody>
              {data.map((d) => (
                <tr key={d.label}><th scope="row">{d.label}</th><td>{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </figure>
  );
}
