import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../../lib/api-client";
import { apiErrorMessage } from "../../lib/errors";
import { formatRelativeShort } from "../../lib/reader";

interface FeedsViewProps {
  articles: Article[];
}

export function FeedsView({ articles }: FeedsViewProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = tsr.feeds.list.useQuery({ queryKey: ["feeds"] });
  const feeds = data?.status === 200 ? data.body : [];

  const [newUrl, setNewUrl] = useState("");
  const createFeed = tsr.feeds.create.useMutation();
  const refreshFeed = tsr.feeds.refresh.useMutation();
  const removeFeed = tsr.feeds.remove.useMutation();

  const [articleUrl, setArticleUrl] = useState("");
  const addLink = tsr.articles.addLink.useMutation();

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["feeds"] });
    queryClient.invalidateQueries({ queryKey: ["articles"] });
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const url = newUrl.trim();
    if (!url) return;
    createFeed.mutate(
      { body: { url } },
      {
        onSuccess: (res) => {
          if (res.status !== 201) return;
          setNewUrl("");
          refreshFeed.mutate({ body: { feedId: res.body.id } }, { onSuccess: invalidate });
        },
      },
    );
  }

  function handleAddLink(e: FormEvent) {
    e.preventDefault();
    const url = articleUrl.trim();
    if (!url) return;
    addLink.mutate(
      { body: { url } },
      {
        onSuccess: (res) => {
          if (res.status !== 201) return;
          setArticleUrl("");
          queryClient.invalidateQueries({ queryKey: ["articles"] });
        },
      },
    );
  }

  function handleRefresh(feedId: string) {
    refreshFeed.mutate({ body: { feedId } }, { onSuccess: invalidate });
  }

  function handleRemove(feedId: string, title: string | null) {
    if (!window.confirm(`Remove "${title ?? "this feed"}"? Its articles stay, but it'll stop refreshing.`)) {
      return;
    }
    removeFeed.mutate({ params: { id: feedId }, body: {} }, { onSuccess: invalidate });
  }

  return (
    <div className="max-w-[820px] px-4 py-6 sm:px-[26px] sm:py-7">
      <h4 className="mb-2 text-[15px] uppercase tracking-[.1em]">Add a single article</h4>
      <p className="mb-4 text-[13px] leading-[1.6] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
        Fetches and adds just this one page — no feed subscription, no ongoing refresh. Runs through
        the same tagging/scoring pipeline as anything from your feeds.
      </p>
      <form onSubmit={handleAddLink} className="mb-2 flex flex-col gap-[10px] sm:flex-row">
        <input
          type="url"
          value={articleUrl}
          onChange={(e) => setArticleUrl(e.target.value)}
          placeholder="https://example.com/some-article"
          required
          className="min-w-0 flex-1 border border-[var(--color-divider)] bg-transparent px-[12px] py-[9px] text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={addLink.isPending || articleUrl.trim().length === 0}
          className="btn-primary text-[12px] uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addLink.isPending ? "Adding…" : "Add article"}
        </button>
      </form>
      {addLink.isError && (
        <p className="mb-2 text-[13px] text-red-600">
          {apiErrorMessage(addLink.error, "Could not add that article.")}
        </p>
      )}
      {addLink.data?.status === 201 && (
        <p className="mb-2 text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Added “{addLink.data.body.title}”.
        </p>
      )}

      <h4 className="mb-5 mt-9 text-[15px] uppercase tracking-[.1em]">Your feeds</h4>

      <form onSubmit={handleAdd} className="mb-7 flex flex-col gap-[10px] sm:flex-row">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://example.com/feed.xml"
          required
          className="min-w-0 flex-1 border border-[var(--color-divider)] bg-transparent px-[12px] py-[9px] text-[13px] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        <button
          type="submit"
          disabled={createFeed.isPending || newUrl.trim().length === 0}
          className="btn-primary text-[12px] uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {createFeed.isPending ? "Adding…" : "Add feed"}
        </button>
      </form>
      {createFeed.isError && (
        <p className="-mt-5 mb-6 text-[13px] text-red-600">
          {apiErrorMessage(createFeed.error, "Could not add that feed.")}
        </p>
      )}

      {isLoading && (
        <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">Loading feeds…</p>
      )}
      {error && (
        <p className="text-[13px] text-red-600">Failed to load feeds: {apiErrorMessage(error)}</p>
      )}

      {!isLoading && !error && feeds.length === 0 && (
        <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
          No feeds yet — paste an RSS/Atom URL above to subscribe to one.
        </p>
      )}

      {!isLoading && !error && feeds.length > 0 && (
        <div className="border border-[var(--color-divider)]">
          {feeds.map((feed) => {
            const count = articles.filter((a) => a.sourceId === feed.id).length;
            return (
              <div
                key={feed.id}
                className="grid grid-cols-1 items-start gap-[10px] border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:gap-[14px]"
              >
                <div className="min-w-0">
                  <div className="type-heading overflow-hidden text-ellipsis whitespace-nowrap text-[15px]">
                    {feed.title ?? feed.url}
                  </div>
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[color-mix(in_srgb,var(--color-text)_50%,transparent)]">
                    {feed.url}
                  </div>
                </div>

                <div className="whitespace-nowrap text-[12px] tabular-nums text-[color-mix(in_srgb,var(--color-text)_55%,transparent)]">
                  {count} article{count === 1 ? "" : "s"}
                </div>

                <div className="whitespace-nowrap text-[12px] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
                  {feed.isActive ? "" : "paused · "}
                  {feed.lastFetched ? `fetched ${formatRelativeShort(feed.lastFetched)} ago` : "never fetched"}
                </div>

                <div className="flex gap-[8px]">
                  <button
                    type="button"
                    onClick={() => handleRefresh(feed.id)}
                    disabled={refreshFeed.isPending}
                    className="cursor-pointer border border-[var(--color-divider)] bg-transparent px-[10px] py-[6px] text-[11px] uppercase tracking-[.07em] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-700)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(feed.id, feed.title)}
                    disabled={removeFeed.isPending}
                    className="cursor-pointer border border-[var(--color-divider)] bg-transparent px-[10px] py-[6px] text-[11px] uppercase tracking-[.07em] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] hover:border-[var(--color-neutral-600)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
