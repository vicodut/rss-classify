import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { PhoneOverlay } from "../components/reader/PhoneOverlay";
import { useReaderKeyboard } from "../components/reader/useReaderKeyboard";

export function HomePage() {
  const [state, setState] = useState<ReaderState>(initialReaderState);
  const queryClient = useQueryClient();

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
  const selArticle =
    (state.selId && articlesById.get(state.selId)) || visible[0] || articles[0] || null;

  const { rate, toggleSave, toggleDismiss } = useArticleMutations();

  const createFeed = tsr.feeds.create.useMutation();
  const refreshFeed = tsr.feeds.refresh.useMutation();

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
  function setMobile(mobile: boolean) {
    setState((s) => ({ ...s, mobile }));
  }

  function handleAddLink() {
    const url = window.prompt("Feed URL (RSS/Atom)");
    if (!url) return;
    createFeed.mutate(
      { body: { url } },
      {
        onSuccess: (res) => {
          if (res.status !== 201) return;
          refreshFeed.mutate(
            { body: { feedId: res.body.id } },
            { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articles"] }) },
          );
        },
        onError: (err) => {
          window.alert(apiErrorMessage(err, "Could not add that feed."));
        },
      },
    );
  }

  useReaderKeyboard({
    visible,
    selId: state.selId,
    articlesById,
    onSelect: select,
    onRate: rate,
    onToggleSave: toggleSave,
    onDismiss: toggleDismiss,
    mobile: state.mobile,
    onCloseMobile: () => setMobile(false),
  });

  const countLabel =
    state.view === "stats"
      ? "last 90 days"
      : state.view === "classify"
        ? `${articles.filter((a) => !a.tagsConfirmed).length} unconfirmed`
        : `${visible.length}${state.view === "saved" ? " saved" : " unread"}${
            state.topic ? " · " + state.topic : ""
          }`;

  const isList = state.view !== "stats" && state.view !== "classify";

  return (
    <div className="grid h-screen" style={{ gridTemplateRows: "auto 1fr" }}>
      <Header
        view={state.view}
        onChangeView={setView}
        countLabel={countLabel}
        onTogglePhone={() => setMobile(!state.mobile)}
        onAddLink={handleAddLink}
        onSignOut={() => supabase.auth.signOut()}
      />

      <div className="grid min-h-0" style={{ gridTemplateColumns: "minmax(0, 210px) minmax(0, 1fr)" }}>
        <NavRail articles={articles} topic={state.topic} onPickTopic={setTopic} />

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

          {!isLoading && !error && isList && (
            <>
              {selArticle && <WhyStrip article={selArticle} />}
              <div>
                {visible.map((a) => (
                  <ArticleRow
                    key={a.id}
                    article={a}
                    selected={a.id === selArticle?.id}
                    onSelect={() => select(a.id)}
                    onRate={(v) => rate(a, v)}
                    onSave={() => toggleSave(a)}
                    onDismiss={() => toggleDismiss(a)}
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
        </main>
      </div>

      {state.mobile && (
        <PhoneOverlay
          view={state.view}
          onChangeView={setView}
          onClose={() => setMobile(false)}
          rows={visible}
          allArticles={articles}
          selId={selArticle?.id ?? null}
          onSelect={select}
          onRate={rate}
          onSave={toggleSave}
          onDismiss={toggleDismiss}
          countLabel={countLabel}
        />
      )}
    </div>
  );
}
