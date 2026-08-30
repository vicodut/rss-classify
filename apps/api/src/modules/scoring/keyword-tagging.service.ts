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
  // Generic verbs/pronouns/fillers that surface as false positives on very
  // short content (an RSS feed that only gives a title-length snippet, with
  // nothing else to distinguish a topical word from ordinary sentence
  // filler by frequency alone).
  "would", "could", "actually", "instead", "take", "takes", "took",
  "taking", "taken", "look", "looks", "looking", "looked", "yourself", "myself",
  "himself", "herself", "itself", "themselves", "lose", "loses", "losing", "lost",
  "let", "lets", "letting", "still", "even", "ever",
  "never", "always", "really", "maybe", "perhaps", "something", "someone",
  "anything", "anyone", "everything", "everyone", "nothing", "nobody", "thing",
  "things", "part", "parts", "kind", "kinds", "sort", "sorts", "give", "gives",
  "given", "giving", "gave", "come", "comes", "came", "coming", "go", "goes",
  "went", "going", "gone", "know", "knows", "knew", "known", "knowing", "think",
  "thinks", "thought", "thinking", "want", "wants", "wanted", "wanting", "need",
  "needs", "needed", "needing", "put", "puts", "putting", "set", "sets", "setting",
]);

const MIN_TERM_LENGTH = 3;
const DEFAULT_MAX_TAGS = 3;
const MIN_RELEVANT_FREQUENCY = 2;

// Also hand-rolled, for the same reason as STOPWORDS: a generic
// languages-and-frameworks package wouldn't know this corpus's own
// ecosystem-specific names (Ecto, Broadway, Livebook, Req, Zeropod, ...).
// Membership only ever reorders terms extractTags already decided were
// significant for this article via TF-IDF — it never adds a tag that
// wasn't already going to be extracted, so a false-positive/omission here
// only affects ranking, not which words can become tags at all.
const TECH_TERMS = new Set([
  "python", "javascript", "typescript", "java", "kotlin", "swift", "ruby", "golang",
  "rust", "elixir", "erlang", "clojure", "scala", "haskell", "perl", "lua", "dart",
  "php", "csharp", "cpp", "julia", "bash", "shell", "sql", "html", "css", "assembly",
  "fortran", "cobol", "matlab", "groovy", "zig", "nim", "crystal", "ocaml", "fsharp",
  "react", "reactjs", "vue", "vuejs", "angular", "svelte", "sveltekit", "nextjs",
  "nuxt", "remix", "django", "flask", "fastapi", "rails", "laravel", "symfony",
  "spring", "springboot", "express", "nestjs", "phoenix", "liveview", "ecto",
  "absinthe", "broadway", "oban", "plug", "cowboy", "bandit", "nerves", "livebook",
  "mix", "hex", "iex", "req", "tensorflow", "pytorch", "keras", "numpy", "pandas",
  "scikit", "docker", "kubernetes", "kubectl", "terraform", "ansible", "puppet",
  "chef", "vagrant", "jenkins", "circleci", "travis", "gitlab", "github", "git",
  "npm", "yarn", "pnpm", "webpack", "vite", "babel", "eslint", "prettier", "jest",
  "mocha", "cypress", "playwright", "selenium", "postgres", "postgresql", "mysql",
  "mongodb", "redis", "sqlite", "cassandra", "elasticsearch", "kafka", "rabbitmq",
  "graphql", "grpc", "websocket", "websockets", "nginx", "apache", "linux", "ubuntu",
  "debian", "macos", "windows", "aws", "gcp", "azure", "cloudflare", "vercel",
  "netlify", "heroku", "supabase", "firebase", "wordpress", "figma", "tailwind",
  "tailwindcss", "bootstrap", "sass", "less", "electron", "flutter", "xamarin",
  "unity", "unreal", "onnx", "huggingface", "openai", "anthropic", "llm", "chatgpt",
  "zeropod",
]);

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
        return { display: capitalize(mostCommonDisplay), score: freq * idf, isTech: TECH_TERMS.has(term), freq };
      })
      // maxTags is a cap, not a quota: on short content (an RSS feed that
      // only gives a title-length snippet), every word appears once, so
      // TF-IDF score can't tell a topical word from ordinary sentence
      // filler — they tie. A term mentioned only once isn't a strong
      // enough signal of what the article is actually about; requiring a
      // repeat is what actually discriminates. Known languages/tools are
      // exempt: naming a real technology is relevant even mentioned once.
      .filter((s) => s.isTech || s.freq >= MIN_RELEVANT_FREQUENCY)
      // A programming language or tool always ranks ahead of a generic term,
      // regardless of relative TF-IDF score — within each of those two
      // groups, still most-distinctive-first.
      .sort((a, b) => (a.isTech === b.isTech ? b.score - a.score : a.isTech ? -1 : 1));

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
