import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../lib/supabase";

/**
 * Placeholder landing page — the article list, filters, and rating dialog
 * (RSS_AGGREGATOR_SPECS.md Phase 1) replace this.
 */
export function HomePage() {
  const { session } = useAuth();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">RSS Aggregator</h1>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          Sign out ({session?.user.email})
        </button>
      </div>
      <p className="text-neutral-500">Article list goes here.</p>
    </div>
  );
}
