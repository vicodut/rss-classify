export interface ArticleRow {
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
}

export interface FeedRow {
  id: string;
  user_id: string;
  url: string;
  title: string | null;
  description: string | null;
  last_fetched: string | null;
  is_active: boolean;
  created_at: string;
}

export interface UserProfileRow {
  id: string;
  tag_weights: Record<string, number>;
  keyword_weights: Record<string, number>;
  total_articles_rated: number;
  average_rating: number;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      articles: {
        Row: ArticleRow;
        Insert: Partial<ArticleRow> &
          Pick<ArticleRow, "user_id" | "url" | "title">;
        Update: Partial<ArticleRow>;
      };
      feeds: {
        Row: FeedRow;
        Insert: Partial<FeedRow> & Pick<FeedRow, "user_id" | "url">;
        Update: Partial<FeedRow>;
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & Pick<UserProfileRow, "id">;
        Update: Partial<UserProfileRow>;
      };
    };
  };
}
