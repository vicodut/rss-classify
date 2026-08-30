import { injectable } from "tsyringe";
import type { TypedSupabaseClient } from "@rss-agg/db";
import type { statsSummarySchema, trendingTagSchema } from "@rss-agg/contract";
import type { z } from "zod";
import { average } from "../../common/utils/math.js";
import { toError } from "../../common/utils/supabase.js";

type StatsSummary = z.infer<typeof statsSummarySchema>;
type TrendingTag = z.infer<typeof trendingTagSchema>;

@injectable()
export class StatsService {
  async summary(db: TypedSupabaseClient): Promise<StatsSummary> {
    const [articlesCount, feedsCount, ratedRows, scoredRows] = await Promise.all([
      db.from("articles").select("*", { count: "exact", head: true }),
      db.from("feeds").select("*", { count: "exact", head: true }),
      db.from("articles").select("user_rating").not("user_rating", "is", null),
      db.from("articles").select("predicted_score").not("predicted_score", "is", null),
    ]);

    if (articlesCount.error) throw articlesCount.error;
    if (feedsCount.error) throw feedsCount.error;
    if (ratedRows.error) throw ratedRows.error;
    if (scoredRows.error) throw scoredRows.error;

    return {
      totalArticles: articlesCount.count ?? 0,
      totalFeeds: feedsCount.count ?? 0,
      totalRated: ratedRows.data.length,
      averageRating: average(ratedRows.data.map((r) => r.user_rating ?? 0)),
      averagePredictedScore: average(scoredRows.data.map((r) => r.predicted_score ?? 0)),
    };
  }

  async trending(db: TypedSupabaseClient, days: number): Promise<TrendingTag[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from("articles").select("tags, user_rating").gte("created_at", since);
    if (error) throw toError(error);

    const byTag = new Map<string, { count: number; ratingSum: number; ratingCount: number }>();
    for (const row of data ?? []) {
      for (const tag of row.tags) {
        const entry = byTag.get(tag) ?? { count: 0, ratingSum: 0, ratingCount: 0 };
        entry.count += 1;
        if (row.user_rating !== null) {
          entry.ratingSum += row.user_rating;
          entry.ratingCount += 1;
        }
        byTag.set(tag, entry);
      }
    }

    return Array.from(byTag.entries())
      .map(([tag, entry]) => ({
        tag,
        count: entry.count,
        averageRating: entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : null,
      }))
      .sort((a, b) => b.count - a.count);
  }
}
