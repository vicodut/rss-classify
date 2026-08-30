import { useEffect } from "react";
import type { Article } from "@rss-agg/contract";

interface UseReaderKeyboardParams {
  visible: Article[];
  selId: string | null;
  articlesById: Map<string, Article>;
  onSelect: (id: string) => void;
  onRate: (article: Article, value: number) => void;
  onToggleSave: (article: Article) => void;
  onDismiss: (article: Article) => void;
  mobile: boolean;
  onCloseMobile: () => void;
}

/**
 * Port of Reader.dc.html's componentDidMount onKey handler: bound on window,
 * no-ops when typing in an input/textarea, moves selection with J/K, rates
 * 1-5, toggles save with S, dismisses + advances with X, opens with Enter,
 * closes the phone overlay with Escape.
 */
export function useReaderKeyboard({
  visible,
  selId,
  articlesById,
  onSelect,
  onRate,
  onToggleSave,
  onDismiss,
  mobile,
  onCloseMobile,
}: UseReaderKeyboardParams) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /INPUT|TEXTAREA/.test(target.tagName)) return;

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
      } else if (e.key === "Escape" && mobile) {
        onCloseMobile();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selId, articlesById, onSelect, onRate, onToggleSave, onDismiss, mobile, onCloseMobile]);
}
