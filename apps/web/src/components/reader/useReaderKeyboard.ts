import { useEffect, useRef } from "react";
import type { Article } from "@rss-agg/contract";

interface UseReaderKeyboardParams {
  visible: Article[];
  selId: string | null;
  articlesById: Map<string, Article>;
  onSelect: (id: string) => void;
  onRate: (article: Article, value: number) => void;
  onToggleSave: (article: Article) => void;
  onDismiss: (article: Article) => void;
}

/**
 * Port of Reader.dc.html's componentDidMount onKey handler: bound on window,
 * no-ops when typing in an input/textarea, moves selection with J/K, rates
 * 1-5, toggles save with S, dismisses + advances with X, opens with Enter.
 *
 * The listener is subscribed once (empty deps) and reads every value through
 * a ref updated on every render, rather than being re-subscribed whenever
 * `visible`/`selId` change — with the old approach, key-repeat firing faster
 * than React's effect-cleanup/resubscribe cycle meant a second "x" press hit
 * the same stale `selId`/`visible` as the first, re-dismissing (toggling
 * back) the same already-selected article instead of advancing to the next
 * one, so rapid X presses removed far fewer articles than were pressed.
 */
export function useReaderKeyboard(params: UseReaderKeyboardParams) {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;

      const { visible, selId, articlesById, onSelect, onRate, onToggleSave, onDismiss } = paramsRef.current;

      const list = visible;
      const i = list.findIndex((a) => a.id === selId);
      const selected = selId ? articlesById.get(selId) : undefined;

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = list[Math.min(i + 1, list.length - 1)];
        if (next) onSelect(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = list[Math.max(i - 1, 0)];
        if (prev) onSelect(prev.id);
      } else if (e.key >= "1" && e.key <= "5") {
        if (selected) onRate(selected, Number(e.key));
      } else if (e.key === "s") {
        if (selected) onToggleSave(selected);
      } else if (e.key === "x") {
        if (selected) {
          onDismiss(selected);
          const next = list[Math.min(i + 1, list.length - 1)];
          if (next) onSelect(next.id);
        }
      } else if (e.key === "Enter") {
        if (selected) window.open(selected.url, "_blank", "noopener");
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
