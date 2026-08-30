import { useMemo } from "react";
import type { Article } from "@rss-agg/contract";
import { displayScore, levelOf } from "./reader";

const DAY_MS = 86_400_000;
const DAY_LABELS = ["6d", "5d", "4d", "3d", "2d", "Yest.", "Today"];

function ingestTimestamp(article: Article): number {
  return new Date(article.createdAt).getTime();
}

export interface DayBar {
  label: string;
  count: number;
  pct: number;
}

export interface ForecastData {
  newTotal: number;
  todayCount: number;
  delta: number;
  days: DayBar[];
  highlights: Article[];
}

/**
 * Trend buckets by createdAt (when this app ingested the article), not
 * publishedAt (the source's own date) — this is meant to answer "is my feed
 * volume picking up or slowing down," not "when was this written."
 * `newArticles` is expected to already be the forecast-view filtered set
 * (not dismissed, not yet rated) so this only has to bucket/rank it.
 */
export function useForecastData(newArticles: Article[]): ForecastData {
  return useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date().setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday - DAY_MS;

    const buckets: number[] = Array.from({ length: 7 }, () => 0);
    for (const a of newArticles) {
      const age = now - ingestTimestamp(a);
      if (age < 0 || age >= 7 * DAY_MS) continue;
      const daysAgo = Math.floor(age / DAY_MS);
      const index = 6 - daysAgo;
      const current = buckets[index];
      if (index < 0 || index > 6 || current === undefined) continue;
      buckets[index] = current + 1;
    }
    const maxBar = Math.max(1, ...buckets);
    const days: DayBar[] = buckets.map((count, i) => ({
      label: DAY_LABELS[i] ?? "",
      count,
      pct: Math.round((count / maxBar) * 100),
    }));

    const todayCount = newArticles.filter((a) => ingestTimestamp(a) >= startOfToday).length;
    const yesterdayCount = newArticles.filter(
      (a) => ingestTimestamp(a) >= startOfYesterday && ingestTimestamp(a) < startOfToday,
    ).length;

    const highlights = [...newArticles]
      .filter((a) => levelOf(displayScore(a)) === "clear")
      .sort((a, b) => displayScore(b) - displayScore(a))
      .slice(0, 4);

    return {
      newTotal: newArticles.length,
      todayCount,
      delta: todayCount - yesterdayCount,
      days,
      highlights,
    };
  }, [newArticles]);
}
