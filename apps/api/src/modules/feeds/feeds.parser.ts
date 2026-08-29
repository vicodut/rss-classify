import Parser from "rss-parser";
import { Effect, Schedule } from "effect";

export class FeedFetchError {
  readonly _tag = "FeedFetchError";
  constructor(
    readonly feedUrl: string,
    readonly message: string,
  ) {}
}

export interface ParsedFeedItem {
  url: string;
  title: string;
  content: string | null;
  publishedAt: string | null;
}

export interface ParsedFeed {
  title: string | null;
  description: string | null;
  items: ParsedFeedItem[];
}

function parsePublishedAt(item: Parser.Item): string | null {
  if (item.isoDate) return item.isoDate;
  if (item.pubDate) {
    const parsed = new Date(item.pubDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function toParsedFeed(feed: Parser.Output<Record<string, unknown>>): ParsedFeed {
  const items: ParsedFeedItem[] = [];
  for (const item of feed.items) {
    if (!item.link) continue;
    items.push({
      url: item.link,
      title: item.title ?? item.link,
      content: item.content ?? item.contentSnippet ?? item.summary ?? null,
      publishedAt: parsePublishedAt(item),
    });
  }
  return { title: feed.title ?? null, description: feed.description ?? null, items };
}

/**
 * Fetches and parses an RSS/Atom feed with a timeout, retrying flaky feed
 * servers with exponential backoff (RSS_AGGREGATOR_SPECS.md "Effect Usage").
 */
export function fetchFeed(url: string, timeoutMs: number): Effect.Effect<ParsedFeed, FeedFetchError> {
  const parser = new Parser({ timeout: timeoutMs });

  return Effect.tryPromise({
    try: () => parser.parseURL(url),
    catch: (e) => new FeedFetchError(url, e instanceof Error ? e.message : String(e)),
  }).pipe(
    Effect.retry(Schedule.exponential("200 millis").pipe(Schedule.intersect(Schedule.recurs(2)))),
    Effect.map(toParsedFeed),
  );
}
