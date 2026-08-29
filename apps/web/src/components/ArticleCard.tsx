import type { Article } from "@rss-agg/contract";

function scoreClasses(score: number) {
  if (score >= 4) return "bg-emerald-100 text-emerald-800";
  if (score >= 2.5) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface ArticleCardProps {
  article: Article;
  onRate: (article: Article) => void;
}

export function ArticleCard({ article, onRate }: ArticleCardProps) {
  const published = formatDate(article.publishedAt);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <a
          href={article.url}
          target="_blank"
          rel="noreferrer"
          className="text-base font-medium text-neutral-900 hover:underline"
        >
          {article.title}
        </a>
        {article.predictedScore !== null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${scoreClasses(article.predictedScore)}`}
            title="Predicted score"
          >
            {article.predictedScore.toFixed(1)} / 5
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
        {article.source && <span>{article.source}</span>}
        {published && (
          <>
            <span aria-hidden>·</span>
            <span>{published}</span>
          </>
        )}
      </div>

      {article.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {article.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        {article.userRating !== null ? (
          <span className="text-sm text-neutral-600">Your rating: {article.userRating} / 5</span>
        ) : (
          <span className="text-sm text-neutral-400">Not rated</span>
        )}
        <button
          onClick={() => onRate(article)}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          {article.userRating !== null ? "Edit rating" : "Rate"}
        </button>
      </div>
    </div>
  );
}
