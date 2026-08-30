import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import type { Article } from "@rss-agg/contract";
import { LEVEL_COLOR, LEVEL_LABEL, displayScore, levelOf } from "../../lib/reader";
import { WeatherIcon } from "./WeatherIcon";

interface WhyStripProps {
  article: Article;
  onUpdateTags: (tags: string[]) => void;
}

/**
 * Tags added/removed here go through PATCH /articles/:id/tags, which sets
 * tags_confirmed=true — this article becomes eligible as k-NN training data
 * for future classification/scoring, not just a display-only edit.
 */
export function WhyStrip({ article, onUpdateTags }: WhyStripProps) {
  const score = displayScore(article);
  const level = levelOf(score);
  const [draft, setDraft] = useState("");

  function addTag() {
    const value = draft.trim();
    setDraft("");
    if (!value || article.tags.includes(value)) return;
    onUpdateTags([...article.tags, value]);
  }

  function removeTag(tag: string) {
    onUpdateTags(article.tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <div className="sticky top-0 z-[5] border-b border-[var(--color-divider)] bg-[var(--color-bg)] px-4 py-[12px] sm:px-5 sm:py-[14px]">
      {/* Mobile: icon+heading row, reason below, full-width button. Desktop:
          single 3-column row (icon | text | button). Two small layouts
          rather than one grid fighting reorder tricks across breakpoints. */}
      <div className="grid gap-2 sm:hidden">
        <div className="flex items-center gap-[10px]">
          <WeatherIcon level={level} size={26} />
          <div
            className="type-heading text-[13px] uppercase tracking-[.08em]"
            style={{ color: LEVEL_COLOR[level] }}
          >
            {LEVEL_LABEL[level]} · {score}/100 — {article.source ?? "Unknown source"}
          </div>
        </div>
        <div className="text-[12px] leading-[1.45] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
          {article.reason ?? "No explanation available for this score yet."}
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary w-full text-center text-[12px] uppercase tracking-[.09em]"
        >
          Open original
        </a>
      </div>

      <div className="hidden items-center gap-4 sm:grid" style={{ gridTemplateColumns: "40px minmax(0,1fr) auto" }}>
        <div className="grid justify-items-center">
          <WeatherIcon level={level} size={30} />
        </div>
        <div className="min-w-0">
          <div
            className="type-heading text-[14px] uppercase tracking-[.1em]"
            style={{ color: LEVEL_COLOR[level] }}
          >
            {LEVEL_LABEL[level]} · {score}/100 — {article.source ?? "Unknown source"}
          </div>
          <div className="text-[12px] leading-[1.45] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
            {article.reason ?? "No explanation available for this score yet."}
          </div>
        </div>
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="btn-primary whitespace-nowrap text-[12px] uppercase tracking-[.09em]"
        >
          Open original
        </a>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-[8px] sm:pl-[56px]">
        {article.tags.map((tag) => (
          <span
            key={tag}
            className="flex items-center gap-[5px] border border-[color-mix(in_srgb,var(--color-accent)_40%,transparent)] px-[8px] py-[3px] text-[11px] uppercase tracking-[.06em] text-[var(--color-accent-700)]"
          >
            {tag}
            <button
              type="button"
              title={`Remove ${tag}`}
              onClick={() => removeTag(tag)}
              className="grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--color-accent-700)] hover:opacity-60"
            >
              <X size={11} strokeWidth={2} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
          placeholder="+ add tag"
          className="w-[110px] border-0 border-b border-[color-mix(in_srgb,var(--color-text)_20%,transparent)] bg-transparent px-[2px] py-[3px] text-[11px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        {!article.tagsConfirmed && article.tags.length > 0 && (
          <span className="text-[10px] uppercase tracking-[.06em] text-[color-mix(in_srgb,var(--color-text)_38%,transparent)]">
            auto-detected — edit to confirm
          </span>
        )}
      </div>
    </div>
  );
}
