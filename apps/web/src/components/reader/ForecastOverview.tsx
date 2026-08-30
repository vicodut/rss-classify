import type { Article } from "@rss-agg/contract";
import { useForecastData } from "../../lib/reader-forecast";
import { ArticleRow } from "./ArticleRow";

interface ForecastOverviewProps {
  newArticles: Article[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRate: (article: Article, rating: number) => void;
  onSave: (article: Article) => void;
  onDismiss: (article: Article) => void;
}

/**
 * Sits above the forecast page's article list: today's volume vs
 * yesterday, a 7-day ingest trend, and the highest-scoring not-yet-decided
 * articles pulled out for visibility (same data as the list below, just
 * re-ranked by score instead of recency).
 */
export function ForecastOverview({
  newArticles,
  selectedId,
  onSelect,
  onRate,
  onSave,
  onDismiss,
}: ForecastOverviewProps) {
  const { newTotal, todayCount, delta, days, highlights } = useForecastData(newArticles);

  return (
    <div className="border-b border-[var(--color-divider)] px-4 py-5 sm:px-[26px] sm:py-6">
      <div className="mb-7 grid grid-cols-1 gap-[22px] sm:grid-cols-3 sm:gap-[30px]">
        <div>
          <div className="text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
            New today
          </div>
          <div className="type-heading text-[36px] leading-[1.1]">{todayCount}</div>
          <div className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]">
            {delta >= 0 ? "+" : ""}
            {delta} vs yesterday
          </div>
        </div>

        <div>
          <div className="text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
            Awaiting you
          </div>
          <div className="type-heading text-[36px] leading-[1.1]">{newTotal}</div>
          <div className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]">
            not yet rated or dismissed
          </div>
        </div>

        <div>
          <div className="mb-2 text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]">
            7-day trend
          </div>
          <div className="flex h-[42px] items-end gap-[5px]">
            {days.map((d) => (
              <div
                key={d.label}
                title={`${d.label}: ${d.count}`}
                className="flex-1 bg-[var(--color-accent)]"
                style={{ height: `${Math.max(4, d.pct)}%` }}
              />
            ))}
          </div>
          <div className="mt-[6px] flex justify-between text-[10px] tabular-nums text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
            <span>{days[0]?.label}</span>
            <span>{days[days.length - 1]?.label}</span>
          </div>
        </div>
      </div>

      {highlights.length > 0 && (
        <div>
          <h4 className="mb-2 text-[13px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
            Catches your eye
          </h4>
          <div className="border border-[var(--color-divider)]">
            {highlights.map((a) => (
              <ArticleRow
                key={a.id}
                article={a}
                selected={a.id === selectedId}
                onSelect={() => onSelect(a.id)}
                onRate={(v) => onRate(a, v)}
                onSave={() => onSave(a)}
                onDismiss={() => onDismiss(a)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
