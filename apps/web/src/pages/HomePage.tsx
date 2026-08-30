import { useMemo, useState } from "react";
import type { Article } from "@rss-agg/contract";
import { tsr } from "../lib/api-client";
import { supabase } from "../lib/supabase";
import { apiErrorMessage } from "../lib/errors";
import { useArticleMutations } from "../lib/useArticleMutations";
import {
  ARTICLES_QUERY_KEY,
  ARTICLES_QUERY_LIMIT,
  initialReaderState,
  visibleArticles,
  type Level,
  type ReaderState,
  type Sort,
  type View,
} from "../lib/reader";
import { Header } from "../components/reader/Header";
import { NavRail } from "../components/reader/NavRail";
import { SearchFilters } from "../components/reader/SearchFilters";
import { WhyStrip } from "../components/reader/WhyStrip";
import { ArticleRow } from "../components/reader/ArticleRow";
import { StatsView } from "../components/reader/StatsView";
import { ClassifyView } from "../components/reader/ClassifyView";
import { FeedsView } from "../components/reader/FeedsView";
import { ForecastOverview } from "../components/reader/ForecastOverview";
import { useReaderKeyboard } from "../components/reader/useReaderKeyboard";

export function HomePage() {
  const [state, setState] = useState<ReaderState>(initialReaderState);

  const { data, isLoading, error } = tsr.articles.list.useQuery({
    queryKey: ARTICLES_QUERY_KEY,
    queryData: { query: { limit: ARTICLES_QUERY_LIMIT } },
  });
  const articles: Article[] = useMemo(
    () => (data?.status === 200 ? data.body.items : []),
    [data],
  );

  const articlesById = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);
  const visible = useMemo(() => visibleArticles(articles, state), [articles, state]);
  // Selected article must come from the current view's filtered list, not
  // the full unfiltered set — otherwise switching to an empty view (e.g.
  // forecast with nothing new left) kept showing whatever was last focused
  // elsewhere, which reads as a stale "why" panel for an article that isn't
  // even in the list beneath it.
  const selArticle = visible.find((a) => a.id === state.selId) ?? visible[0] ?? null;

  const { rate, toggleSave, dismiss, updateTags } = useArticleMutations();

  function setView(view: View) {
    setState((s) => ({ ...s, view }));
  }
  function setTopic(topic: string | null) {
    setState((s) => ({ ...s, topic }));
  }
  function setQuery(query: string) {
    setState((s) => ({ ...s, query }));
  }
  function setLevel(level: Level) {
    setState((s) => ({ ...s, level }));
  }
  function setMinRating(minRating: number) {
    setState((s) => ({ ...s, minRating }));
  }
  function setSort(sort: Sort) {
    setState((s) => ({ ...s, sort }));
  }
  function select(id: string) {
    setState((s) => ({ ...s, selId: id }));
  }

  useReaderKeyboard({
    visible,
    selId: state.selId,
    articlesById,
    onSelect: select,
    onRate: rate,
    onToggleSave: toggleSave,
    onDismiss: dismiss,
  });

  const countLabel =
    state.view === "stats"
      ? "last 90 days"
      : state.view === "classify"
        ? `${articles.filter((a) => !a.tagsConfirmed).length} unconfirmed`
        : state.view === "feeds"
          ? "feed sources"
          : `${visible.length}${
              state.view === "saved" ? " saved" : state.view === "forecast" ? " new" : " unread"
            }${state.topic ? " · " + state.topic : ""}`;

  const isList = state.view !== "stats" && state.view !== "classify" && state.view !== "feeds";

  return (
    <div className="grid h-screen min-w-0 overflow-x-hidden" style={{ gridTemplateRows: "auto 1fr" }}>
      <Header
        view={state.view}
        onChangeView={setView}
        countLabel={countLabel}
        onAddLink={() => setView("feeds")}
        onSignOut={() => supabase.auth.signOut()}
      />

      <div className="grid min-h-0 md:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
        <div className="hidden md:block">
          <NavRail articles={articles} topic={state.topic} onPickTopic={setTopic} />
        </div>

        <main className="reader-scroll min-w-0 overflow-y-auto">
          {isLoading && (
            <p className="p-6 text-[13px] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
              Loading articles…
            </p>
          )}
          {error && (
            <p className="p-6 text-[13px] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
              Failed to load articles: {apiErrorMessage(error)}
            </p>
          )}

          {!isLoading && !error && state.view === "search" && (
            <SearchFilters
              query={state.query}
              onQueryChange={setQuery}
              level={state.level}
              onLevelChange={setLevel}
              minRating={state.minRating}
              onMinRatingChange={setMinRating}
              sort={state.sort}
              onSortChange={setSort}
            />
          )}

          {!isLoading && !error && state.view === "forecast" && (
            <ForecastOverview
              newArticles={visible}
              selectedId={selArticle?.id ?? null}
              onSelect={select}
              onRate={rate}
              onSave={toggleSave}
              onDismiss={dismiss}
            />
          )}

          {!isLoading && !error && isList && (
            <>
              {selArticle && (
                <WhyStrip article={selArticle} onUpdateTags={(tags) => updateTags(selArticle, tags)} />
              )}
              <div>
                {visible.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    selected={a.id === selArticle?.id}
                    onSelect={() => select(a.id)}
                    onRate={(v) => rate(a, v)}
                    onSave={() => toggleSave(a)}
                    onDismiss={() => dismiss(a)}
                  />
                ))}
                {visible.length === 0 && (
                  <div className="p-[70px_22px] text-center text-[13px] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
                    Nothing matches this view.
                  </div>
                )}
              </div>
            </>
          )}

          {!isLoading && !error && state.view === "stats" && <StatsView articles={articles} />}
          {!isLoading && !error && state.view === "classify" && <ClassifyView articles={articles} />}
          {!isLoading && !error && state.view === "feeds" && <FeedsView articles={articles} />}
        </main>
      </div>
    </div>
  );
}
