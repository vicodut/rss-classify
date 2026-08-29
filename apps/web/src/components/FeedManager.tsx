import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tsr } from "../lib/api-client";
import { apiErrorMessage } from "../lib/errors";

export function FeedManager() {
  const [url, setUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const feeds = tsr.feeds.list.useQuery({ queryKey: ["feeds"] });
  const createFeed = tsr.feeds.create.useMutation();
  const removeFeed = tsr.feeds.remove.useMutation();
  const refreshFeeds = tsr.feeds.refresh.useMutation();

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createFeed.mutate(
      { body: { url } },
      {
        onSuccess: () => {
          setUrl("");
          queryClient.invalidateQueries({ queryKey: ["feeds"] });
        },
        onError: (err) => {
          setFormError(apiErrorMessage(err));
        },
      },
    );
  }

  function handleRemove(id: string) {
    removeFeed.mutate(
      { params: { id }, body: {} },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feeds"] }) },
    );
  }

  function handleRefresh() {
    refreshFeeds.mutate(
      { body: {} },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["articles"] });
          queryClient.invalidateQueries({ queryKey: ["feeds"] });
        },
      },
    );
  }

  const feedList = feeds.data?.status === 200 ? feeds.data.body : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Feeds</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshFeeds.isPending}
          className="rounded-md border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {refreshFeeds.isPending ? "Refreshing…" : "Refresh feeds"}
        </button>
      </div>

      {refreshFeeds.data?.status === 200 && (
        <p className="text-xs text-neutral-500">
          Fetched {refreshFeeds.data.body.articlesFetched}, added{" "}
          {refreshFeeds.data.body.articlesCreated} new.
        </p>
      )}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="url"
          required
          placeholder="https://example.com/feed.xml"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="flex-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={createFeed.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {formError && <p className="text-xs text-red-600">{formError}</p>}

      {feeds.isLoading ? (
        <p className="text-sm text-neutral-500">Loading feeds…</p>
      ) : feedList.length === 0 ? (
        <p className="text-sm text-neutral-500">No feeds yet. Add one above.</p>
      ) : (
        <ul className="divide-y divide-neutral-200">
          {feedList.map((feed) => (
            <li key={feed.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-800">{feed.title ?? feed.url}</p>
                <p className="truncate text-xs text-neutral-400">{feed.url}</p>
              </div>
              <button
                onClick={() => handleRemove(feed.id)}
                disabled={removeFeed.isPending}
                className="shrink-0 text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
