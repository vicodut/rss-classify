import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../lib/api-client";
import { apiErrorMessage } from "../lib/errors";

interface RatingDialogProps {
  article: Article;
  onClose: () => void;
}

export function RatingDialog({ article, onClose }: RatingDialogProps) {
  const [rating, setRating] = useState(article.userRating ?? 0);
  const [tags, setTags] = useState<string[]>(article.tags);
  const [tagInput, setTagInput] = useState("");
  const queryClient = useQueryClient();
  const rate = tsr.articles.rate.useMutation();

  function addTag() {
    const value = tagInput.trim();
    if (value && !tags.includes(value)) {
      setTags([...tags, value]);
    }
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) return;
    rate.mutate(
      { params: { id: article.id }, body: { rating, tags } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["articles"] });
          onClose();
        },
      },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-lg"
      >
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Rate article</h2>
          <p className="mt-1 truncate text-sm text-neutral-500">{article.title}</p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">Rating</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
                className={`text-2xl leading-none ${value <= rating ? "text-amber-500" : "text-neutral-300"}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-neutral-700">Tags</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  className="text-neutral-400 hover:text-neutral-700"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={addTag}
            placeholder="Add a tag and press Enter"
            className="w-full rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </div>

        {rate.error && (
          <p className="text-sm text-red-600">{apiErrorMessage(rate.error)}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={rating < 1 || rate.isPending}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {rate.isPending ? "Saving…" : "Save rating"}
          </button>
        </div>
      </form>
    </div>
  );
}
