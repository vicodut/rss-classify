import { X } from "lucide-react";
import type { Article } from "@rss-agg/contract";
import { cn } from "../../lib/cn";
import type { View } from "../../lib/reader";
import { useStatsData } from "../../lib/reader-stats";
import { KpiTile } from "./KpiTile";
import { PhoneArticleRow } from "./PhoneArticleRow";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "saved", label: "Saved" },
  { value: "search", label: "Search" },
  { value: "stats", label: "Stats" },
];

interface PhoneOverlayProps {
  view: View;
  onChangeView: (view: View) => void;
  onClose: () => void;
  rows: Article[];
  allArticles: Article[];
  selId: string | null;
  onSelect: (id: string) => void;
  onRate: (article: Article, value: number) => void;
  onSave: (article: Article) => void;
  onDismiss: (article: Article) => void;
  countLabel: string;
}

export function PhoneOverlay({
  view,
  onChangeView,
  onClose,
  rows,
  allArticles,
  selId,
  onSelect,
  onRate,
  onSave,
  onDismiss,
  countLabel,
}: PhoneOverlayProps) {
  const { kpis } = useStatsData(allArticles);
  const isStats = view === "stats";

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[color-mix(in_srgb,var(--color-neutral-900)_55%,transparent)]">
      <div
        className="relative grid bg-[var(--color-bg)]"
        style={{
          width: 390,
          height: 780,
          gridTemplateRows: "auto auto 1fr auto",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="blueprint pointer-events-none absolute inset-0">
          <i className="corner tl" />
          <i className="corner tr" />
          <i className="corner bl" />
          <i className="corner br" />
        </div>

        <div className="flex items-center justify-between px-[18px] pb-3 pt-4">
          <span className="type-heading text-[17px] uppercase tracking-[.1em]">Forecast</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 cursor-pointer place-items-center border border-[var(--color-divider)] bg-transparent text-[var(--color-text)] hover:border-[var(--color-accent)]"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>

        <div className="mx-[18px] mb-2 flex border border-[var(--color-divider)]">
          {VIEW_OPTIONS.map((opt) => {
            const active = opt.value === view;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeView(opt.value)}
                className={cn(
                  "type-heading flex-1 cursor-pointer border-0 border-l border-l-[var(--color-divider)] py-[9px] text-[11px] uppercase tracking-[.08em]",
                  active
                    ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                    : "bg-transparent text-[color-mix(in_srgb,var(--color-text)_68%,transparent)]",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="reader-scroll overflow-y-auto">
          {!isStats &&
            rows.map((a) => (
              <PhoneArticleRow
                key={a.id}
                article={a}
                selected={a.id === selId}
                onSelect={() => onSelect(a.id)}
                onRate={(v) => onRate(a, v)}
                onSave={() => onSave(a)}
                onDismiss={() => onDismiss(a)}
              />
            ))}
          {isStats && (
            <div className="grid gap-4 p-[18px]">
              {kpis.map((k) => (
                <KpiTile key={k.label} kpi={k} valueSize={36} padding="px-4 py-[14px]" />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-divider)] px-[18px] py-3 text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
          {countLabel}
        </div>
      </div>
    </div>
  );
}
