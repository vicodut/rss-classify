import { injectable } from "tsyringe";
import { DEFAULT_TAGS } from "@rss-agg/contract";
import { average, clamp } from "../../common/utils/math.js";

export const DEFAULT_TAG_WEIGHTS: Record<string, number> = Object.fromEntries(
  DEFAULT_TAGS.map((tag) => [tag, 0.5]),
);

export interface ScorableArticle {
  tags: string[];
  title: string;
  content: string | null;
}

export interface PreferenceWeights {
  tagWeights: Record<string, number>;
  keywordWeights: Record<string, number>;
}

/**
 * Phase 1/2 scoring engine from RSS_AGGREGATOR_SPECS.md. Pure — takes data
 * in, returns numbers/weights out. Callers (articles/feeds services) own all
 * DB reads and writes.
 */
@injectable()
export class ScoringService {
  scoreArticle(article: ScorableArticle, weights: PreferenceWeights): number {
    const tagScore = average(article.tags.map((tag) => weights.tagWeights[tag] ?? 0));

    const text = `${article.title} ${article.content ?? ""}`.toLowerCase();
    const matchedKeywords = Object.keys(weights.keywordWeights).filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    );
    const keywordScore = average(matchedKeywords.map((keyword) => weights.keywordWeights[keyword] ?? 0));

    const score = tagScore * 0.6 + keywordScore * 0.4;
    return clamp(score, 0, 5);
  }

  /**
   * Phase 2 learning step: nudges the weight of every tag on the rated
   * article by +/-0.05 depending on whether the user liked it, clamped to
   * [0, 1]. Ratings of 3 are neutral and leave weights untouched.
   */
  learnFromRating(
    tagWeights: Record<string, number>,
    tags: string[],
    rating: number,
  ): Record<string, number> {
    if (rating < 4 && rating > 2) return tagWeights;

    const delta = rating >= 4 ? 0.05 : -0.05;
    const updated = { ...tagWeights };
    for (const tag of tags) {
      const current = updated[tag] ?? 0.5;
      updated[tag] = clamp(current + delta, 0, 1);
    }
    return updated;
  }
}
