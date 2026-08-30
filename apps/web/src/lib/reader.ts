import type { Article } from "@rss-agg/contract";

/** Shared query key for the single high-limit article fetch this whole view is built on. */
export const ARTICLES_QUERY_KEY = ["articles", { limit: 500 }] as const;
export const ARTICLES_QUERY_LIMIT = 500;

export type View = "forecast" | "pool" | "saved" | "search" | "stats" | "classify" | "feeds";
export type Level = "all" | "clear" | "maybe" | "rain";
export type ArticleLevel = "clear" | "maybe" | "rain";
export type Sort = "forecast" | "recent" | "rating";

export interface ReaderState {
  view: View;
  topic: string | null;
  query: string;
  level: Level;
  minRating: number; // 0-5, 0 = any
  sort: Sort;
  selId: string | null;
}

export const initialReaderState: ReaderState = {
  view: "forecast",
  topic: null,
  query: "",
  level: "all",
  minRating: 0,
  sort: "forecast",
  selId: null,
};

/** 0-100 display score, mapped from the backend's 0-5 predictedScore. */
export function displayScore(article: Article): number {
  const raw = Math.round((article.predictedScore ?? 0) * 20);
  return Math.min(100, Math.max(0, raw));
}

export function levelOf(score: number): ArticleLevel {
  if (score >= 75) return "clear";
  if (score >= 50) return "maybe";
  return "rain";
}

export const LEVEL_LABEL: Record<ArticleLevel, string> = {
  clear: "Likely",
  maybe: "Maybe",
  rain: "Probably not",
};

/** Text colour for the level label in the why-strip / KPI notes. */
export const LEVEL_COLOR: Record<ArticleLevel, string> = {
  clear: "var(--color-accent-700)",
  maybe: "var(--color-neutral-700)",
  rain: "var(--color-neutral-600)",
};

/**
 * Reading minutes are not tracked by the backend — estimate from word count
 * (content stripped of HTML tags, ~200 wpm), falling back to a flat 3 minutes
 * when there's no content to measure.
 */
export function estimateReadingMinutes(content: string | null): number {
  if (!content) return 3;
  const words = content
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (words === 0) return 3;
  return Math.max(1, Math.round(words / 200));
}

/** Short relative time label, e.g. "2h", "4h", "1d" — matches the design's `when` column. */
export function formatRelativeShort(iso: string | null): string {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

function articleTimestamp(article: Article): number {
  return new Date(article.publishedAt ?? article.createdAt).getTime();
}

/**
 * Faithful port of the design's `visible()` method: filters the full article
 * set by view/topic/search/level/minRating, then sorts. All done client-side
 * over a single high-limit fetch, exactly mirroring Reader.dc.html's SEED-array
 * architecture.
 */
export function visibleArticles(articles: Article[], state: ReaderState): Article[] {
  const q = state.query.trim().toLowerCase();
  let list = articles.filter((a) => {
    // "pool" = the active queue, everything not dismissed (matches the old
    // "inbox" behaviour). "forecast" is a stricter subset of that: also
    // excludes anything already rated — new/undecided articles only, since
    // the forecast page's whole point is "what haven't I looked at yet."
    if (state.view === "pool" && a.isDismissed) return false;
    if (state.view === "forecast" && (a.isDismissed || a.userRating !== null)) return false;
    if (state.view === "saved" && !a.isSaved) return false;
    if (state.topic && !a.tags.includes(state.topic)) return false;
    if (state.view === "search") {
      if (state.level !== "all" && levelOf(displayScore(a)) !== state.level) return false;
      if (state.minRating && (a.userRating ?? 0) < state.minRating) return false;
    }
    if (q && !`${a.title} ${a.source ?? ""} ${a.tags.join(" ")}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const by = state.view === "search" ? state.sort : "recent";
  if (by === "forecast") {
    list = [...list].sort((x, y) => displayScore(y) - displayScore(x));
  } else if (by === "recent") {
    list = [...list].sort((x, y) => articleTimestamp(y) - articleTimestamp(x));
  } else {
    list = [...list].sort((x, y) => (y.userRating ?? 0) - (x.userRating ?? 0));
  }
  return list;
}

/** Topic/classification counts over the whole article set, not the current view — matches the design's nav rail. */
export function topicCounts(articles: Article[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const a of articles) {
    for (const t of a.tags) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}
