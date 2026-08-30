import { injectable } from "tsyringe";

// Deliberately hand-rolled rather than a dependency: this corpus is a mix of
// English and French tech blogs, and a generic stopword package wouldn't
// know about blog/web noise words ("http", "article", "read") that would
// otherwise dominate every article's tag list regardless of topic.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with",
  "is", "are", "was", "were", "be", "been", "being", "this", "that", "these", "those",
  "it", "its", "as", "by", "from", "not", "no", "yes", "you", "your", "we", "our",
  "they", "their", "he", "she", "his", "her", "me", "my", "us", "them", "what",
  "which", "who", "whom", "when", "where", "why", "how", "all", "each", "every",
  "both", "few", "more", "most", "other", "some", "such", "only", "own", "same",
  "so", "than", "too", "very", "can", "will", "just", "should", "now", "also",
  "about", "into", "over", "after", "before", "between", "out", "up", "down",
  "if", "then", "else", "because", "while", "during", "again", "once",
  "here", "there", "do", "does", "did", "doing", "have", "has", "had", "having",
  "don", "didn", "isn", "wasn", "aren", "weren", "won", "wouldn",
  "new", "one", "two", "three", "get", "gets", "getting", "like", "use", "used",
  "using", "make", "makes", "made", "way", "ways", "time", "times", "many", "much",
  "http", "https", "www", "com", "org", "html", "blog", "post", "article",
  "read", "reading", "click", "link", "via", "update", "updated",
  "le", "la", "les", "un", "une", "des", "de", "du", "et", "ou", "mais", "dans", "sur",
  "pour", "avec", "est", "sont", "ce", "cette", "ces", "il", "elle", "ils", "elles",
  "je", "tu", "nous", "vous", "son", "sa", "ses", "leur", "leurs", "que", "qui",
  "quoi", "dont", "ne", "pas", "plus", "très", "tout", "tous", "toute", "toutes",
  "au", "aux", "par", "se", "ça", "cela", "être", "avoir", "fait", "faire", "comme",
  "si", "on", "en", "y", "aussi", "alors", "donc", "ainsi",
]);

const MIN_TERM_LENGTH = 3;
const DEFAULT_MAX_TAGS = 3;

export interface CorpusStats {
  documentFrequency: Map<string, number>;
  totalDocuments: number;
}

const NAMED_ENTITIES: Record<string, string> = {
  quot: '"',
  amp: "&",
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  hellip: "...",
  mdash: "-",
  ndash: "-",
};

/**
 * Strips tags and decodes/removes HTML entities. Without this, an
 * undecoded `&quot;` would tokenize as the fake word "quot" (the tokenizer
 * only looks for letter sequences, oblivious to the surrounding `&`/`;`) —
 * common enough in RSS content to otherwise show up as a bogus tag.
 */
function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]+>/g, " ");
  const namedDecoded = withoutTags.replace(
    /&([a-z]+);/gi,
    (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match,
  );
  const numericDecoded = namedDecoded.replace(/&#(\d+);/g, (_match, code: string) =>
    String.fromCharCode(Number(code)),
  );
  // Fallback: remove anything still entity-shaped rather than let it tokenize as a fake word.
  return numericDecoded.replace(/&[a-z0-9#]+;/gi, " ");
}

/** Tracks each lowercase term's original casing so a tag can display as "Elixir" or "GenServer" instead of a flattened lowercase form. */
function tokenizeWithCasing(text: string): { lower: string; display: string }[] {
  const matches = text.match(/[\p{L}][\p{L}\p{N}-]*/gu) ?? [];
  return matches.map((word) => ({ lower: word.toLowerCase(), display: word }));
}

function isSignificant(term: string): boolean {
  return term.length >= MIN_TERM_LENGTH && !STOPWORDS.has(term) && !/^\d+$/.test(term);
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word[0]!.toUpperCase() + word.slice(1);
}

/**
 * Real content-based tagging: TF-IDF-style keyword extraction across the
 * user's own article corpus — not a fixed category list, and not a k-NN vote
 * against previously-assigned tags (which can only ever reproduce whatever
 * was already in a confirmed pool, never name something new). A term that's
 * common in *this* article but rare across the rest of the corpus (e.g.
 * "elixir" in a mostly-dev-blog corpus that only sometimes covers Elixir
 * specifically) scores highly; generic words common everywhere score low
 * regardless of raw frequency.
 */
@injectable()
export class KeywordTaggingService {
  buildCorpusStats(documents: { title: string; content: string | null }[]): CorpusStats {
    const documentFrequency = new Map<string, number>();
    for (const doc of documents) {
      const text = `${doc.title} ${stripHtml(doc.content ?? "")}`;
      const uniqueTerms = new Set(
        tokenizeWithCasing(text)
          .map((t) => t.lower)
          .filter(isSignificant),
      );
      for (const term of uniqueTerms) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }
    return { documentFrequency, totalDocuments: documents.length };
  }

  extractTags(
    title: string,
    content: string | null,
    corpus: CorpusStats,
    maxTags = DEFAULT_MAX_TAGS,
  ): string[] {
    const text = `${title} ${stripHtml(content ?? "")}`;
    const tokens = tokenizeWithCasing(text).filter((t) => isSignificant(t.lower));
    if (tokens.length === 0) return [];

    const termFrequency = new Map<string, number>();
    const displayForms = new Map<string, Map<string, number>>();
    for (const { lower, display } of tokens) {
      termFrequency.set(lower, (termFrequency.get(lower) ?? 0) + 1);
      const forms = displayForms.get(lower) ?? new Map<string, number>();
      forms.set(display, (forms.get(display) ?? 0) + 1);
      displayForms.set(lower, forms);
    }

    const scored = [...termFrequency.entries()]
      .map(([term, freq]) => {
        const df = corpus.documentFrequency.get(term) ?? 0;
        const idf = Math.log((corpus.totalDocuments + 1) / (df + 1)) + 1;
        const forms = displayForms.get(term)!;
        const mostCommonDisplay = [...forms.entries()].sort((a, b) => b[1] - a[1])[0]![0];
        return { display: capitalize(mostCommonDisplay), score: freq * idf };
      })
      .sort((a, b) => b.score - a.score);

    const tags: string[] = [];
    const seen = new Set<string>();
    for (const s of scored) {
      if (seen.has(s.display)) continue;
      seen.add(s.display);
      tags.push(s.display);
      if (tags.length >= maxTags) break;
    }
    return tags;
  }
}
