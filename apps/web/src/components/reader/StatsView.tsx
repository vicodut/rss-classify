import type { Article } from "@rss-agg/contract";
import { useStatsData } from "../../lib/reader-stats";
import { KpiTile } from "./KpiTile";

interface StatsViewProps {
  articles: Article[];
}

export function StatsView({ articles }: StatsViewProps) {
  const { kpis, dist, weeks, topicStats } = useStatsData(articles);

  return (
    <div className="grid gap-[30px] px-[26px] pb-[50px] pt-7">
      <div className="grid grid-cols-4 gap-[22px]">
        {kpis.map((k) => (
          <KpiTile key={k.label} kpi={k} valueSize={40} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-[30px]">
        <div>
          <h4 className="mb-4 text-[15px] uppercase tracking-[.1em]">Rating distribution</h4>
          <div className="grid gap-[9px]">
            {dist.map((d) => (
              <div
                key={d.rating}
                className="grid items-center gap-3"
                style={{ gridTemplateColumns: "60px 1fr 34px" }}
              >
                <div className="flex gap-[3px]">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="block h-2 w-2 border"
                      style={{
                        background: i < d.rating ? "var(--color-accent)" : "transparent",
                        borderColor:
                          i < d.rating
                            ? "var(--color-accent)"
                            : "color-mix(in srgb, var(--color-text) 22%, transparent)",
                      }}
                    />
                  ))}
                </div>
                <div className="h-[14px] border border-[var(--color-divider)]">
                  <div className="h-full bg-[var(--color-accent)]" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="text-right text-[12px] tabular-nums text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-[15px] uppercase tracking-[.1em]">Reading volume · 12 weeks</h4>
          <div className="flex h-[132px] items-end gap-[6px] border-b border-[var(--color-divider)]">
            {weeks.map((w, i) => (
              <div key={i} className="flex h-full flex-1 flex-col justify-end gap-[2px]">
                <div className="bg-[var(--color-accent)]" style={{ height: `${w.readPct}%` }} />
                <div
                  className="bg-[color-mix(in_srgb,var(--color-text)_14%,transparent)]"
                  style={{ height: `${w.dismissedPct}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-[10px] flex gap-[18px] text-[11px] text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]">
            <span className="flex items-center gap-[6px]">
              <span className="block h-[9px] w-[9px] bg-[var(--color-accent)]" />
              read
            </span>
            <span className="flex items-center gap-[6px]">
              <span className="block h-[9px] w-[9px] bg-[color-mix(in_srgb,var(--color-text)_14%,transparent)]" />
              dismissed
            </span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-[15px] uppercase tracking-[.1em]">Forecast accuracy by classification</h4>
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr>
              <th className="border-b border-[var(--color-divider)] p-[6.8px] text-left text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Classification
              </th>
              <th className="border-b border-[var(--color-divider)] p-[6.8px] text-right text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Saved
              </th>
              <th className="border-b border-[var(--color-divider)] p-[6.8px] text-right text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Read
              </th>
              <th className="border-b border-[var(--color-divider)] p-[6.8px] text-right text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Avg rating
              </th>
              <th className="border-b border-[var(--color-divider)] p-[6.8px] text-right text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Forecast hit
              </th>
              <th className="w-[150px] border-b border-[var(--color-divider)] p-[6.8px] text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
                Trend
              </th>
            </tr>
          </thead>
          <tbody>
            {topicStats.map((t) => (
              <tr key={t.name} className="hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]">
                <td className="type-heading border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px] text-[15px]">
                  {t.name}
                </td>
                <td className="border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px] text-right tabular-nums">
                  {t.saved}
                </td>
                <td className="border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px] text-right tabular-nums">
                  {t.read}
                </td>
                <td className="border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px] text-right tabular-nums">
                  {t.avg}
                </td>
                <td
                  className="border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px] text-right tabular-nums"
                  style={{ color: t.hitColor }}
                >
                  {t.hit}
                </td>
                <td className="border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] p-[6.8px]">
                  <div className="h-[10px] border border-[var(--color-divider)]">
                    <div className="h-full" style={{ width: `${t.hitPct}%`, background: t.hitColor }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
