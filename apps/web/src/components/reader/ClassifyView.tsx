import { useQueryClient } from "@tanstack/react-query";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../../lib/api-client";
import { apiErrorMessage } from "../../lib/errors";

interface ClassifyViewProps {
  articles: Article[];
}

/**
 * Two independent, explicitly-triggered operations — deliberately kept
 * separate rather than bundled, since they touch different columns and
 * candidate sets: tag extraction only ever otherwise runs automatically for
 * genuinely new articles at ingest (feeds.service.ts), never as a side
 * effect of rating; rescoring-from-ratings is the same k-NN pass rate()
 * backgrounds after every rating, exposed here so it can be re-run on
 * demand (e.g. after tuning tag_knn_k in settings) without waiting on a new
 * rating to trigger it.
 */
export function ClassifyView({ articles }: ClassifyViewProps) {
  const queryClient = useQueryClient();
  const classifyTags = tsr.articles.classify.useMutation();
  const rescoreRatings = tsr.articles.classify.useMutation();

  const unconfirmed = articles.filter((a) => !a.tagsConfirmed);
  const untagged = unconfirmed.filter((a) => a.tags.length === 0);
  const unrated = articles.filter((a) => a.userRating == null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }

  function handleClassifyTags() {
    classifyTags.mutate(
      { body: { mode: "tags" } },
      { onSuccess: (res) => res.status === 200 && invalidate() },
    );
  }

  function handleRescoreRatings() {
    rescoreRatings.mutate(
      { body: { mode: "ratings" } },
      { onSuccess: (res) => res.status === 200 && invalidate() },
    );
  }

  return (
    <div className="max-w-[560px] px-4 py-6 sm:px-[26px] sm:py-7">
      <h4 className="mb-4 text-[15px] uppercase tracking-[.1em]">Classify articles</h4>

      <section className="mb-8">
        <h5 className="mb-2 text-[13px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
          Extract tags
        </h5>
        <p className="mb-4 text-[13px] leading-[1.6] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Tags are extracted from each article&rsquo;s own content — no fixed category list, and
          no dependency on tags you&rsquo;ve already confirmed. This looks at your{" "}
          {unconfirmed.length} not-yet-confirmed article{unconfirmed.length === 1 ? "" : "s"} (
          {untagged.length} completely untagged) and picks the 2-3 terms most distinctive to each
          one relative to the rest of your feed. New articles get this automatically as they come
          in — run it manually here to re-tag older unconfirmed ones as your feed grows.
        </p>
        <button
          type="button"
          onClick={handleClassifyTags}
          disabled={classifyTags.isPending || unconfirmed.length === 0}
          className="btn-primary text-[12px] uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {classifyTags.isPending ? "Classifying…" : "Run tag classification"}
        </button>
        {classifyTags.isError && (
          <p className="mt-4 text-[13px] text-red-600">{apiErrorMessage(classifyTags.error)}</p>
        )}
        {classifyTags.data?.status === 200 && (
          <p className="mt-4 text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            Tagged {classifyTags.data.body.articlesUpdated} of {classifyTags.data.body.candidatesConsidered}{" "}
            candidates considered.
            {classifyTags.data.body.candidatesConsidered > classifyTags.data.body.articlesUpdated
              ? " The rest had too little content to extract anything meaningful from."
              : ""}
          </p>
        )}
      </section>

      <section>
        <h5 className="mb-2 text-[13px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_80%,transparent)]">
          Rescore from ratings
        </h5>
        <p className="mb-4 text-[13px] leading-[1.6] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Recomputes predicted scores for your {unrated.length} unrated article
          {unrated.length === 1 ? "" : "s"} using your rating history (nearest-neighbor over
          articles you&rsquo;ve rated) — tags are left untouched. This normally happens
          automatically in the background right after you rate something; run it manually here to
          refresh scores after changing preference settings.
        </p>
        <button
          type="button"
          onClick={handleRescoreRatings}
          disabled={rescoreRatings.isPending || unrated.length === 0}
          className="btn-primary text-[12px] uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rescoreRatings.isPending ? "Rescoring…" : "Run rescore"}
        </button>
        {rescoreRatings.isError && (
          <p className="mt-4 text-[13px] text-red-600">{apiErrorMessage(rescoreRatings.error)}</p>
        )}
        {rescoreRatings.data?.status === 200 && (
          <p className="mt-4 text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
            Rescored {rescoreRatings.data.body.articlesUpdated} of{" "}
            {rescoreRatings.data.body.candidatesConsidered} candidates considered.
          </p>
        )}
      </section>
    </div>
  );
}
