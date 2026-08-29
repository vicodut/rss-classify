import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";
import { TagFilters } from "../components/TagFilters";
import { ArticleList } from "../components/ArticleList";
import { FeedManager } from "../components/FeedManager";

export function HomePage() {
  const { session } = useAuth();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [feedsOpen, setFeedsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">RSS Aggregator</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setFeedsOpen((open) => !open)}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              {feedsOpen ? "Hide feeds" : "Manage feeds"}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-neutral-500 hover:text-neutral-800"
            >
              Sign out ({session?.user.email})
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-8 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {feedsOpen && (
            <aside className="rounded-lg border border-neutral-200 bg-white p-4 lg:w-80 lg:shrink-0">
              <FeedManager />
            </aside>
          )}

          <div className="min-w-0 flex-1 space-y-4">
            <TagFilters selectedTag={selectedTag} onChange={setSelectedTag} />
            <ArticleList tag={selectedTag} />
          </div>
        </div>
      </main>
    </div>
  );
}
