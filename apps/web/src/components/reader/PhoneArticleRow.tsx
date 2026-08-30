import { Bookmark, X } from "lucide-react";
import type { Article } from "@rss-agg/contract";
import { cn } from "../../lib/cn";
import {
  displayScore,
  estimateReadingMinutes,
  formatRelativeShort,
  levelOf,
} from "../../lib/reader";
import { WeatherIcon } from "./WeatherIcon";

interface PhoneArticleRowProps {
  article: Article;
  selected: boolean;
  onSelect: () => void;
  onRate: (value: number) => void;
  onSave: () => void;
  onDismiss: () => void;
}

/**
 * Tap selects only — doesn't open the URL. On mobile, WhyStrip's "Open
 * original" button (full-width, always visible once a row is selected) is
 * the explicit way to open an article; auto-opening on tap as well makes
 * the row itself a mis-tap hazard and is redundant with that button.
 * Desktop's ArticleRow keeps click-to-open (no separate button visible
 * without selecting first there, and hover affordance makes intent clearer).
 */
export function PhoneArticleRow({
  article,
  selected,
  onSelect,
  onRate,
  onSave,
  onDismiss,
}: PhoneArticleRowProps) {
  const score = displayScore(article);
  const level = levelOf(score);
  const rating = article.userRating ?? 0;
  const minutes = estimateReadingMinutes(article.content);
  const when = formatRelativeShort(article.publishedAt ?? article.createdAt);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "grid cursor-pointer items-start gap-[10px] border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] border-l-[3px] px-[18px] py-[13px]",
        selected ? "border-l-[var(--color-accent)]" : "border-l-transparent",
        article.isDismissed && "opacity-40",
      )}
      style={{ gridTemplateColumns: "44px minmax(0,1fr)" }}
    >
      <div className="grid justify-items-center gap-[1px]">
        <WeatherIcon level={level} size={22} />
        <span
          className="text-[9px] tabular-nums"
          style={{
            color:
              level === "clear"
                ? "var(--color-accent-700)"
                : "color-mix(in srgb, var(--color-text) 40%, transparent)",
          }}
        >
          {score}
        </span>
      </div>

      <div className="grid min-w-0 gap-[5px]">
        <div
          className={cn(
            "type-heading line-clamp-2 text-[16px] leading-[1.2]",
            level === "rain" && "text-[color-mix(in_srgb,var(--color-text)_55%,transparent)]",
          )}
        >
          {article.title}
        </div>
        <div className="text-[10px] uppercase tracking-[.07em] text-[color-mix(in_srgb,var(--color-text)_44%,transparent)]">
          {article.source ?? "Unknown source"} · {when} · {minutes}m
        </div>
        <div className="mt-[2px] flex items-center justify-between gap-[10px]">
          <div className="flex gap-[6px]">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRate(v);
                }}
                className="grid h-11 w-8 cursor-pointer place-items-center border-0 bg-transparent p-0"
              >
                <span
                  className="block h-[14px] w-[14px] border"
                  style={{
                    background: v <= rating ? "var(--color-accent)" : "transparent",
                    borderColor:
                      v <= rating
                        ? "var(--color-accent)"
                        : "color-mix(in srgb, var(--color-text) 25%, transparent)",
                  }}
                />
              </button>
            ))}
          </div>
          <div className="flex gap-[6px]">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave();
              }}
              className="grid h-11 w-11 cursor-pointer place-items-center border p-0"
              style={{
                borderColor: article.isSaved ? "var(--color-accent)" : "var(--color-divider)",
                background: article.isSaved ? "var(--color-accent)" : "transparent",
                color: article.isSaved
                  ? "var(--color-bg)"
                  : "color-mix(in srgb, var(--color-text) 40%, transparent)",
              }}
            >
              <Bookmark size={17} strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="grid h-11 w-11 cursor-pointer place-items-center border border-[var(--color-divider)] bg-transparent p-0 text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]"
            >
              <X size={17} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
