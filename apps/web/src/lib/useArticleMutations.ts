import { useQueryClient } from "@tanstack/react-query";
import type { Article } from "@rss-agg/contract";
import { tsr } from "./api-client";
import { ARTICLES_QUERY_KEY } from "./reader";

/**
 * Rating pips, save and dismiss all mutate a single article and want the
 * dense list to update instantly without a full refetch. Each mutation here
 * patches the one changed article directly into the existing articles query
 * cache on success.
 */
export function useArticleMutations() {
  const queryClient = useQueryClient();

  function patchArticle(updated: Article) {
    queryClient.setQueryData(ARTICLES_QUERY_KEY, (old: unknown) => {
      if (!old || typeof old !== "object" || (old as { status?: number }).status !== 200) {
        return old;
      }
      const typed = old as { status: 200; body: { items: Article[]; nextCursor: string | null } };
      return {
        ...typed,
        body: {
          ...typed.body,
          items: typed.body.items.map((a) => (a.id === updated.id ? updated : a)),
        },
      };
    });
  }

  const rateMutation = tsr.articles.rate.useMutation();
  const removeRatingMutation = tsr.articles.removeRating.useMutation();
  const toggleSaveMutation = tsr.articles.toggleSave.useMutation();
  const dismissMutation = tsr.articles.dismiss.useMutation();
  const updateTagsMutation = tsr.articles.updateTags.useMutation();

  /** Clicking the currently-set rating pip clears the rating (no "0" value on the rate endpoint). */
  function rate(article: Article, value: number) {
    if (article.userRating === value) {
      removeRatingMutation.mutate(
        { params: { id: article.id }, body: {} },
        { onSuccess: (res) => res.status === 200 && patchArticle(res.body) },
      );
    } else {
      rateMutation.mutate(
        { params: { id: article.id }, body: { rating: value } },
        { onSuccess: (res) => res.status === 200 && patchArticle(res.body) },
      );
    }
  }

  function toggleSave(article: Article) {
    toggleSaveMutation.mutate(
      { params: { id: article.id }, body: {} },
      { onSuccess: (res) => res.status === 200 && patchArticle(res.body) },
    );
  }

  function dismiss(article: Article) {
    dismissMutation.mutate(
      { params: { id: article.id }, body: {} },
      { onSuccess: (res) => res.status === 200 && patchArticle(res.body) },
    );
  }

  /**
   * Full-replacement, matches the backend's semantics — sets
   * tags_confirmed=true, making this article eligible as a k-NN neighbor
   * for future classification/scoring (see updateTags in articles.service.ts).
   */
  function updateTags(article: Article, tags: string[]) {
    updateTagsMutation.mutate(
      { params: { id: article.id }, body: { tags } },
      { onSuccess: (res) => res.status === 200 && patchArticle(res.body) },
    );
  }

  return { rate, toggleSave, dismiss, updateTags };
}
