import { useState } from "react";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../lib/api-client";
import { apiErrorMessage } from "../lib/errors";
import { ArticleCard } from "./ArticleCard";
import { RatingDialog } from "./RatingDialog";

interface ArticleListProps {
  tag: string | null;
}

export function ArticleList({ tag }: ArticleListProps) {
  const [ratingArticle, setRatingArticle] = useState<Article | null>(null);

  const { data, isLoading, error } = tsr.articles.list.useQuery({
    queryKey: ["articles", { tag }],
    queryData: { query: { tag: tag ?? undefined, limit: 50 } },
  });

  if (isLoading) {
    return <p className="text-sm text-neutral-500">Loading articles…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-red-600">
        Failed to load articles: {apiErrorMessage(error)}
      </p>
    );
  }

  const articles = data?.status === 200 ? data.body.items : [];

  if (articles.length === 0) {
    return (
      <p className="text-sm text-neutral-500">
        No articles yet{tag ? ` for "${tag}"` : ""}. Add a feed and refresh to get started.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} onRate={setRatingArticle} />
        ))}
      </div>
      {ratingArticle && (
        <RatingDialog article={ratingArticle} onClose={() => setRatingArticle(null)} />
      )}
    </>
  );
}
