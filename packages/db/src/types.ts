// These are `type` aliases rather than `interface`s deliberately: the
// Supabase JS client's generic Database plumbing checks `Row extends
// Record<string, unknown>` (and similar) internally, and TypeScript only
// grants object *type aliases* an implicit index signature for that check —
// `interface`s are treated as open/nominal and fail it, which collapses
// every `.from(...)` query's inferred type to `never`.
export type ArticleRow = {
  id: string;
  user_id: string;
  url: string;
  title: string;
  content: string | null;
  source: string | null;
  tags: string[];
  user_rating: number | null;
  predicted_score: number | null;
  created_at: string;
  published_at: string | null;
  source_id: string | null;
  is_saved: boolean;
  is_dismissed: boolean;
  reason: string | null;
};

export type FeedRow = {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  last_fetched: string | null;
  is_active: boolean;
  created_at: string;
};

export type UserProfileRow = {
  id: string;
  tag_weights: Record<string, number>;
  keyword_weights: Record<string, number>;
  total_articles_rated: number;
  average_rating: number;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      articles: {
        Row: ArticleRow;
        Insert: Partial<ArticleRow> &
          Pick<ArticleRow, "user_id" | "url" | "title">;
        Update: Partial<ArticleRow>;
        Relationships: [];
      };
      feeds: {
        Row: FeedRow;
        Insert: Partial<FeedRow> & Pick<FeedRow, "user_id" | "url">;
        Update: Partial<FeedRow>;
        Relationships: [];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & Pick<UserProfileRow, "id">;
        Update: Partial<UserProfileRow>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
  };
};
