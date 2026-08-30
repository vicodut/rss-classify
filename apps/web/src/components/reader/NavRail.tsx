import { Sun, Cloud, CloudRain } from "lucide-react";
import { cn } from "../../lib/cn";
import type { Article } from "@rss-agg/contract";
import { topicCounts } from "../../lib/reader";

interface NavRailProps {
  articles: Article[];
  topic: string | null;
  onPickTopic: (topic: string | null) => void;
}

export function NavRail({ articles, topic, onPickTopic }: NavRailProps) {
  const topics = topicCounts(articles);

  return (
    <nav className="reader-scroll overflow-y-auto border-r border-[var(--color-divider)] py-5">
      <div className="flex items-baseline justify-between px-[22px] pb-[10px]">
        <span className="text-[10px] uppercase tracking-[.16em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
          Classification
        </span>
        <span className="text-[10px] tracking-[.06em] text-[color-mix(in_srgb,var(--color-text)_32%,transparent)]">
          fluid
        </span>
      </div>

      {[{ name: "All classifications", key: null, count: articles.length }, ...topics.map((t) => ({ ...t, key: t.name }))].map(
        (t) => {
          const active = topic === t.key;
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => onPickTopic(t.key)}
              className={cn(
                "grid w-full items-center gap-[11px] py-[6px] pr-[22px] text-left text-[14px]",
                active
                  ? "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-[var(--color-accent-900)]"
                  : "text-[color-mix(in_srgb,var(--color-text)_78%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-text)_5%,transparent)]",
              )}
              style={{ gridTemplateColumns: "3px 1fr auto" }}
            >
              <span
                className="h-[14px]"
                style={{ background: active ? "var(--color-accent)" : "transparent" }}
              />
              <span className="overflow-hidden text-ellipsis whitespace-nowrap">{t.name}</span>
              <span className="text-[11px] tabular-nums text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
                {t.count}
              </span>
            </button>
          );
        },
      )}

      <div className="px-[22px] pb-[10px] pt-[26px] text-[10px] uppercase tracking-[.16em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
        Forecast key
      </div>
      <div className="grid gap-[10px] px-[22px]">
        <div
          className="grid items-center gap-[10px] text-[12px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]"
          style={{ gridTemplateColumns: "22px 1fr" }}
        >
          <Sun width={20} height={20} color="var(--color-accent-700)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <span>Likely — clear</span>
        </div>
        <div
          className="grid items-center gap-[10px] text-[12px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]"
          style={{ gridTemplateColumns: "22px 1fr" }}
        >
          <Cloud width={20} height={20} color="var(--color-neutral-600)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <span>Maybe — overcast</span>
        </div>
        <div
          className="grid items-center gap-[10px] text-[12px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]"
          style={{ gridTemplateColumns: "22px 1fr" }}
        >
          <CloudRain width={20} height={20} color="var(--color-neutral-500)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <span>Probably not — rain</span>
        </div>
      </div>

      <div className="mx-[22px] mt-[26px] border-t border-[var(--color-divider)] pt-4 text-[11px] leading-[1.85] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
        <div>J / K &nbsp;&nbsp;move</div>
        <div>1 – 5 &nbsp;&nbsp;rate</div>
        <div>S &nbsp;&nbsp;save &nbsp;·&nbsp; X &nbsp;&nbsp;dismiss</div>
        <div>Enter &nbsp;&nbsp;open</div>
      </div>
    </nav>
  );
}
