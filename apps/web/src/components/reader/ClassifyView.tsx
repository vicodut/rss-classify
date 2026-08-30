import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../../lib/api-client";
import { apiErrorMessage } from "../../lib/errors";

interface ClassifyViewProps {
  articles: Article[];
}

/**
 * Tags are open-ended (no fixed category list) — extracted directly from
 * each article's own content (TF-IDF over your corpus, not a vote against
 * previously-assigned tags), so a term like "elixir" surfaces on its own
 * once it's distinctive relative to the rest of your feed. This page runs
 * it on demand rather than only automatically at feed-ingest time, since a
 * re-run benefits from the corpus having grown since the last pass.
 */
export function ClassifyView({ articles }: ClassifyViewProps) {
  const queryClient = useQueryClient();
  const classify = tsr.articles.classify.useMutation();
  const [result, setResult] = useState<{ candidatesConsidered: number; articlesTagged: number } | null>(null);

  const unconfirmed = articles.filter((a) => !a.tagsConfirmed);
  const untagged = unconfirmed.filter((a) => a.tags.length === 0);

  function handleRun() {
    setResult(null);
    classify.mutate(
      { body: {} },
      {
        onSuccess: (res) => {
          if (res.status !== 200) return;
          setResult(res.body);
          queryClient.invalidateQueries({ queryKey: ["articles"] });
        },
      },
    );
  }

  return (
    <div className="max-w-[560px] px-[26px] py-7">
      <h4 className="mb-4 text-[15px] uppercase tracking-[.1em]">Classify articles</h4>
      <p className="mb-6 text-[13px] leading-[1.6] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
        Tags are extracted from each article&rsquo;s own content — no fixed category list, and
        no dependency on tags you&rsquo;ve already confirmed. Running this looks at your{" "}
        {unconfirmed.length} not-yet-confirmed article{unconfirmed.length === 1 ? "" : "s"} (
        {untagged.length} completely untagged) and picks the 2-3 terms most distinctive to each
        one relative to the rest of your feed.
      </p>

      <button
        type="button"
        onClick={handleRun}
        disabled={classify.isPending || unconfirmed.length === 0}
        className="btn-primary text-[12px] uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {classify.isPending ? "Classifying…" : "Run classification"}
      </button>

      {classify.isError && <p className="mt-4 text-[13px] text-red-600">{apiErrorMessage(classify.error)}</p>}

      {result && (
        <p className="mt-4 text-[13px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
          Tagged {result.articlesTagged} of {result.candidatesConsidered} candidates considered.
          {result.candidatesConsidered > result.articlesTagged
            ? " The rest had too little content to extract anything meaningful from."
            : ""}
        </p>
      )}
    </div>
  );
}
