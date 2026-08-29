import { injectable } from "tsyringe";

/**
 * Default keyword -> tag map for the 9 built-in tags. Intentionally coarse;
 * users refine scoring over time via ratings (see ScoringService.learnFromRating)
 * and can adjust profile.keywordWeights directly via PATCH /profile.
 */
export const DEFAULT_TAG_KEYWORDS: Record<string, string[]> = {
  Tech: [
    "software",
    "ai",
    "artificial intelligence",
    "machine learning",
    "programming",
    "developer",
    "startup",
    "app",
    "computer",
    "coding",
    "cloud",
    "cybersecurity",
    "internet",
    "gadget",
    "robot",
    "chip",
    "silicon valley",
  ],
  Politics: [
    "election",
    "government",
    "president",
    "senate",
    "congress",
    "policy",
    "vote",
    "campaign",
    "political",
    "legislation",
    "minister",
    "parliament",
    "diplomat",
  ],
  Art: [
    "art",
    "artist",
    "painting",
    "gallery",
    "museum",
    "sculpture",
    "exhibit",
    "exhibition",
    "design",
    "creative",
    "photography",
    "architecture",
  ],
  Science: [
    "science",
    "research",
    "study",
    "scientist",
    "physics",
    "biology",
    "chemistry",
    "space",
    "nasa",
    "experiment",
    "discovery",
    "astronomy",
    "climate",
  ],
  Sports: [
    "sport",
    "sports",
    "game",
    "team",
    "player",
    "match",
    "championship",
    "league",
    "coach",
    "tournament",
    "football",
    "basketball",
    "soccer",
    "olympic",
    "athlete",
  ],
  Business: [
    "business",
    "market",
    "economy",
    "company",
    "startup",
    "investor",
    "stock",
    "finance",
    "revenue",
    "ceo",
    "trade",
    "merger",
    "ipo",
  ],
  Health: [
    "health",
    "medical",
    "doctor",
    "disease",
    "treatment",
    "hospital",
    "medicine",
    "wellness",
    "vaccine",
    "mental health",
    "nutrition",
    "surgery",
  ],
  Entertainment: [
    "movie",
    "film",
    "music",
    "celebrity",
    "tv",
    "television",
    "show",
    "entertainment",
    "actor",
    "actress",
    "concert",
    "album",
    "streaming",
  ],
  Education: [
    "education",
    "school",
    "university",
    "student",
    "teacher",
    "college",
    "learning",
    "curriculum",
    "academic",
    "scholarship",
    "classroom",
  ],
};

/**
 * Keyword -> tag matching against title + content. Pure — no DB access.
 * An article can match, and be tagged with, more than one tag.
 */
@injectable()
export class TaggingService {
  tagArticle(
    title: string,
    content: string | null,
    keywordMap: Record<string, string[]> = DEFAULT_TAG_KEYWORDS,
  ): string[] {
    const text = `${title} ${content ?? ""}`.toLowerCase();
    const tags: string[] = [];
    for (const [tag, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((keyword) => text.includes(keyword.toLowerCase()))) {
        tags.push(tag);
      }
    }
    return tags;
  }
}
