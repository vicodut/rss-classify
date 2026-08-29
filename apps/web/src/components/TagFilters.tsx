import { DEFAULT_TAGS } from "@rss-agg/contract";

interface TagFiltersProps {
  selectedTag: string | null;
  onChange: (tag: string | null) => void;
}

export function TagFilters({ selectedTag, onChange }: TagFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {DEFAULT_TAGS.map((tag) => {
        const active = tag === selectedTag;
        return (
          <button
            key={tag}
            onClick={() => onChange(active ? null : tag)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              active
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            }`}
          >
            {tag}
          </button>
        );
      })}
      {selectedTag && (
        <button
          onClick={() => onChange(null)}
          className="text-sm text-neutral-500 hover:text-neutral-800"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
