import type { Article } from "@rss-agg/contract";
import { LEVEL_COLOR, LEVEL_LABEL, displayScore, levelOf } from "../../lib/reader";
import { WeatherIcon } from "./WeatherIcon";

interface WhyStripProps {
  article: Article;
}

export function WhyStrip({ article }: WhyStripProps) {
  const score = displayScore(article);
  const level = levelOf(score);

  return (
    <div
      className="sticky top-0 z-[5] grid items-center gap-4 border-b border-[var(--color-divider)] bg-[var(--color-bg)] px-5 py-[14px]"
      style={{ gridTemplateColumns: "40px minmax(0,1fr) auto" }}
    >
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
  );
}
