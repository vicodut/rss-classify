import { Effect, Schedule } from "effect";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

export class ArticleFetchError {
  readonly _tag = "ArticleFetchError";
  constructor(
    readonly url: string,
    readonly message: string,
  ) {}
}

export interface ParsedArticleLink {
  title: string;
  content: string | null;
  source: string | null;
  publishedAt: string | null;
}

function extractSiteName(document: Document, url: string): string | null {
  const content = document.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim();
  if (content) return content;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const DATE_SELECTORS = [
  'meta[property="article:published_time"]',
  'meta[name="publish-date"]',
  'meta[name="date"]',
  "time[datetime]",
];

function extractPublishedAt(document: Document): string | null {
  for (const selector of DATE_SELECTORS) {
    const el = document.querySelector(selector);
    const raw = el?.getAttribute("content") ?? el?.getAttribute("datetime");
    if (!raw) continue;
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

async function fetchAndExtract(url: string, timeoutMs: number): Promise<ParsedArticleLink> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Some sites block requests with no/unknown user agent outright.
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RSSAggregatorBot/1.0; +https://github.com)" },
    });
    if (!res.ok) throw new Error(`Fetching that page returned HTTP ${res.status}`);
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const parsed = reader.parse();
    if (!parsed || !parsed.title) {
      throw new Error("Couldn't find readable article content on that page");
    }

    return {
      title: parsed.title,
      content: parsed.content ?? null,
      source: extractSiteName(dom.window.document, url),
      publishedAt: extractPublishedAt(dom.window.document),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches a single arbitrary page (not an RSS feed) and extracts its
 * readable article content via Mozilla's Readability — the same
 * extraction approach most "read later" tools use, since a raw page's
 * HTML mixes the article body with nav/ads/sidebar markup that a
 * hand-rolled strip has no principled way to separate. `content` comes
 * back as sanitized HTML (matching how RSS-sourced content is stored),
 * downstream stripHtml()/prepareTextForEmbedding() already handle that.
 */
export function fetchArticleLink(url: string, timeoutMs: number): Effect.Effect<ParsedArticleLink, ArticleFetchError> {
  return Effect.tryPromise({
    try: () => fetchAndExtract(url, timeoutMs),
    catch: (e) => new ArticleFetchError(url, e instanceof Error ? e.message : String(e)),
  }).pipe(Effect.retry(Schedule.exponential("200 millis").pipe(Schedule.intersect(Schedule.recurs(1)))));
}
