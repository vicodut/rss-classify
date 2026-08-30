import type { Level, Sort } from "../../lib/reader";
import { SegmentedControl } from "./SegmentedControl";

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "all", label: "All" },
  { value: "clear", label: "Likely" },
  { value: "maybe", label: "Maybe" },
  { value: "rain", label: "Unlikely" },
];

const RATING_OPTIONS: { value: string; label: string }[] = [0, 1, 2, 3, 4, 5].map((n) => ({
  value: String(n),
  label: n === 0 ? "Any" : `${n}+`,
}));

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "forecast", label: "Forecast" },
  { value: "recent", label: "Newest" },
  { value: "rating", label: "Rating" },
];

interface SearchFiltersProps {
  query: string;
  onQueryChange: (query: string) => void;
  level: Level;
  onLevelChange: (level: Level) => void;
  minRating: number;
  onMinRatingChange: (minRating: number) => void;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
}

export function SearchFilters({
  query,
  onQueryChange,
  level,
  onLevelChange,
  minRating,
  onMinRatingChange,
  sort,
  onSortChange,
}: SearchFiltersProps) {
  return (
    <div className="grid gap-4 border-b border-[var(--color-divider)] px-[22px] pb-[18px] pt-[22px]">
      <input
        type="text"
        placeholder="Search titles, sources, notes"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="type-heading min-h-[44px] border border-[var(--color-divider)] bg-transparent px-[10px] py-[6px] text-[17px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-accent)]"
      />
      <div className="flex flex-wrap items-center gap-[22px]">
        <div className="grid gap-[6px]">
          <span className="text-[10px] uppercase tracking-[.14em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
            Forecast
          </span>
          <SegmentedControl options={LEVEL_OPTIONS} value={level} onChange={onLevelChange} />
        </div>
        <div className="grid gap-[6px]">
          <span className="text-[10px] uppercase tracking-[.14em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
            Minimum rating
          </span>
          <SegmentedControl
            options={RATING_OPTIONS}
            value={String(minRating)}
            onChange={(v) => onMinRatingChange(Number(v))}
            tabular
          />
        </div>
        <div className="grid gap-[6px]">
          <span className="text-[10px] uppercase tracking-[.14em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
            Sort
          </span>
          <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={onSortChange} />
        </div>
      </div>
    </div>
  );
}
