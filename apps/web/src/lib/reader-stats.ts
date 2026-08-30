import { useMemo } from "react";
import type { Article } from "@rss-agg/contract";
import { displayScore, estimateReadingMinutes, levelOf } from "./reader";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

function articleTimestamp(article: Article): number {
  return new Date(article.publishedAt ?? article.createdAt).getTime();
}

/**
 * The backend has no "article was opened/read" event — only userRating,
 * isSaved and isDismissed. Everywhere below, "read" is approximated as
 * "has a non-null userRating" (the closest real signal of engagement we
 * have); "dismissed" is the real isDismissed flag. Everything else (rating
 * average/distribution, forecast hit rate, per-classification averages)
 * is computed exactly from real data.
 */
function isRead(article: Article): boolean {
  return article.userRating !== null;
}

export interface Kpi {
  label: string;
  value: string;
  note: string;
}

export interface DistRow {
  rating: number;
  count: number;
  pct: number;
}

export interface WeekBar {
  readCount: number;
  dismissedCount: number;
  readPct: number;
  dismissedPct: number;
}

export interface TopicStat {
  name: string;
  saved: number;
  read: number;
  avg: string;
  hit: string;
  hitPct: number;
  hitColor: string;
}

export interface StatsData {
  kpis: Kpi[];
  dist: DistRow[];
  weeks: WeekBar[];
  topicStats: TopicStat[];
}

export function useStatsData(articles: Article[]): StatsData {
  return useMemo(() => computeStats(articles), [articles]);
}

function computeStats(articles: Article[]): StatsData {
  const now = Date.now();

  // --- KPIs ---
  const last30 = articles.filter((a) => now - articleTimestamp(a) <= 30 * DAY_MS && isRead(a));
  const prev30 = articles.filter((a) => {
    const age = now - articleTimestamp(a);
    return age > 30 * DAY_MS && age <= 60 * DAY_MS && isRead(a);
  });
  const readDelta = last30.length - prev30.length;

  const rated = articles.filter((a) => a.userRating !== null);
  const avgRating = rated.length
    ? rated.reduce((sum, a) => sum + (a.userRating ?? 0), 0) / rated.length
    : 0;

  const clearArticles = articles.filter((a) => levelOf(displayScore(a)) === "clear");
  const ratedClear = clearArticles.filter((a) => a.userRating !== null);
  const hitClear = ratedClear.filter((a) => (a.userRating ?? 0) >= 4);
  const hitRate = ratedClear.length ? Math.round((hitClear.length / ratedClear.length) * 100) : 0;

  const readArticles = articles.filter(isRead);
  const readingMinutes = readArticles.map((a) => estimateReadingMinutes(a.content));
  const totalMinutes = readingMinutes.reduce((sum, m) => sum + m, 0);
  const hours = totalMinutes / 60;
  const medianMinutes = median(readingMinutes);

  const kpis: Kpi[] = [
    {
      label: "Read · 30 days",
      value: String(last30.length),
      note: `${readDelta >= 0 ? "+" : ""}${readDelta} vs previous`,
    },
    {
      label: "Average rating",
      value: rated.length ? avgRating.toFixed(1) : "—",
      note: `of ${rated.length} rated`,
    },
    {
      label: "Forecast hit rate",
      value: `${hitRate}%`,
      note: "likely → rated 4+",
    },
    {
      label: "Hours reading",
      value: hours.toFixed(1),
      note: `${medianMinutes} min median`,
    },
  ];

  // --- Rating distribution ---
  const total = rated.length || 1;
  const dist: DistRow[] = [1, 2, 3, 4, 5].map((n) => {
    const count = rated.filter((a) => a.userRating === n).length;
    return { rating: n, count, pct: Math.round((count / total) * 100) };
  });

  // --- Reading volume, 12 weeks, oldest first ---
  const weekBuckets: { read: number; dismissed: number }[] = Array.from({ length: 12 }, () => ({
    read: 0,
    dismissed: 0,
  }));
  for (const a of articles) {
    const age = now - articleTimestamp(a);
    if (age < 0 || age >= 12 * WEEK_MS) continue;
    const weeksAgo = Math.floor(age / WEEK_MS); // 0 = this week
    const index = 11 - weeksAgo; // oldest (11 weeks ago) first
    if (index < 0 || index > 11) continue;
    const bucket = weekBuckets[index];
    if (!bucket) continue;
    if (isRead(a)) bucket.read += 1;
    if (a.isDismissed) bucket.dismissed += 1;
  }
  const maxBar = Math.max(1, ...weekBuckets.flatMap((w) => [w.read, w.dismissed]));
  const weeks: WeekBar[] = weekBuckets.map((w) => ({
    readCount: w.read,
    dismissedCount: w.dismissed,
    readPct: Math.round((w.read / maxBar) * 100),
    dismissedPct: Math.round((w.dismissed / maxBar) * 100),
  }));

  // --- Per-classification (topic) stats ---
  const topicNames = new Map<string, number>();
  for (const a of articles) {
    for (const t of a.tags) topicNames.set(t, (topicNames.get(t) ?? 0) + 1);
  }
  const topicStats: TopicStat[] = [...topicNames.keys()]
    .sort((a, b) => (topicNames.get(b) ?? 0) - (topicNames.get(a) ?? 0))
    .map((name) => {
      const inTopic = articles.filter((a) => a.tags.includes(name));
      const saved = inTopic.filter((a) => a.isSaved).length;
      const read = inTopic.filter(isRead).length;
      const ratedInTopic = inTopic.filter((a) => a.userRating !== null);
      const avg = ratedInTopic.length
        ? (ratedInTopic.reduce((sum, a) => sum + (a.userRating ?? 0), 0) / ratedInTopic.length).toFixed(1)
        : "—";
      const clearInTopic = inTopic.filter((a) => levelOf(displayScore(a)) === "clear");
      const ratedClearInTopic = clearInTopic.filter((a) => a.userRating !== null);
      const hitInTopic = ratedClearInTopic.filter((a) => (a.userRating ?? 0) >= 4);
      const hitPct = ratedClearInTopic.length
        ? Math.round((hitInTopic.length / ratedClearInTopic.length) * 100)
        : 0;
      return {
        name,
        saved,
        read,
        avg,
        hit: ratedClearInTopic.length ? `${hitPct}%` : "—",
        hitPct: ratedClearInTopic.length ? hitPct : 0,
        hitColor: hitPct >= 70 ? "var(--color-accent)" : "var(--color-neutral-500)",
      };
    });

  return { kpis, dist, weeks, topicStats };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? 0;
}
