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
import { PhoneArticleRow } from "./PhoneArticleRow";

interface ArticleRowProps {
  article: Article;
  selected: boolean;
  onSelect: () => void;
  onRate: (value: number) => void;
  onSave: () => void;
  onDismiss: () => void;
}

/**
 * Two layouts in one component, toggled by breakpoint (CSS only, no JS
 * media-query state) rather than a manual "phone view" toggle: the dense
 * single-row desktop grid below `sm`, or the already-built stacked
 * PhoneArticleRow layout (bigger touch targets, wrapped title) at `sm` and
 * above. Every call site gets both for free without knowing which renders.
 */
export function ArticleRow(props: ArticleRowProps) {
  return (
    <>
      <div className="sm:hidden">
        <PhoneArticleRow {...props} />
      </div>
      <DesktopArticleRow {...props} />
    </>
  );
}

function DesktopArticleRow({ article, selected, onSelect, onRate, onSave, onDismiss }: ArticleRowProps) {
  const score = displayScore(article);
  const level = levelOf(score);
  const rating = article.userRating ?? 0;
  const minutes = estimateReadingMinutes(article.content);
  const when = formatRelativeShort(article.publishedAt ?? article.createdAt);

  return (
    <div
      onClick={() => {
        onSelect();
        window.open(article.url, "_blank", "noopener");
      }}
      className={cn(
        "hidden h-[52px] cursor-pointer items-center gap-[14px] border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] pr-5 border-l-[3px] sm:grid",
        "hover:bg-[color-mix(in_srgb,var(--color-text)_4%,transparent)]",
        selected
          ? "bg-[color-mix(in_srgb,var(--color-accent)_9%,transparent)] border-l-[var(--color-accent)]"
          : "border-l-transparent",
        article.isDismissed && "opacity-40",
      )}
      style={{ gridTemplateColumns: "52px minmax(0,1fr) auto" }}
    >
      <div className="grid justify-items-center gap-[1px]">
        <WeatherIcon level={level} size={19} />
        <span
          className="text-[9px] tabular-nums tracking-[.06em]"
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

      <div className="flex min-w-0 items-baseline gap-[14px] overflow-hidden">
        <span
          className={cn(
            "type-heading min-w-0 flex-[0_1_auto] overflow-hidden text-ellipsis whitespace-nowrap text-[17px] leading-[1.2]",
            level === "rain" && "text-[color-mix(in_srgb,var(--color-text)_55%,transparent)]",
          )}
        >
          {article.title}
        </span>
        <span className="ml-auto flex flex-none items-baseline gap-[10px]">
          <span className="whitespace-nowrap text-[11px] uppercase tracking-[.07em] text-[color-mix(in_srgb,var(--color-text)_44%,transparent)]">
            {article.source ?? "Unknown source"}{" "}
            <span className="normal-case tracking-normal tabular-nums text-[color-mix(in_srgb,var(--color-text)_32%,transparent)]">
              · {when} · {minutes}m
            </span>
          </span>
          {article.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="flex-none whitespace-nowrap border border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] px-[7px] py-[2px] text-[10px] uppercase tracking-[.07em] text-[var(--color-accent-700)]"
            >
              {tag}
            </span>
          ))}
        </span>
      </div>

      <div className="flex items-center gap-[12px]">
        <div className="flex gap-[3px]">
          {[1, 2, 3, 4, 5].map((v) => (
            <button
              key={v}
              type="button"
              title={`Rate ${v}`}
              onClick={(e) => {
                e.stopPropagation();
                onRate(v);
              }}
              className="grid h-6 w-[14px] cursor-pointer place-items-center border-0 bg-transparent p-0 hover:opacity-55"
            >
              <span
                className="block h-2 w-2 border"
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

        <div className="flex gap-[5px]">
          <button
            type="button"
            title="Save for later"
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
            className="grid h-[27px] w-[27px] cursor-pointer place-items-center border p-0 hover:border-[var(--color-accent)]"
            style={{
              borderColor: article.isSaved ? "var(--color-accent)" : "var(--color-divider)",
              background: article.isSaved ? "var(--color-accent)" : "transparent",
              color: article.isSaved ? "var(--color-bg)" : "color-mix(in srgb, var(--color-text) 40%, transparent)",
            }}
          >
            <Bookmark size={14} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            title="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="grid h-[27px] w-[27px] cursor-pointer place-items-center border border-[var(--color-divider)] bg-transparent p-0 text-[color-mix(in_srgb,var(--color-text)_40%,transparent)] hover:border-[var(--color-neutral-600)] hover:text-[var(--color-text)]"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
