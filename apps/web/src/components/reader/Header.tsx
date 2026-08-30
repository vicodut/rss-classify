import type { View } from "../../lib/reader";
import { SegmentedControl } from "./SegmentedControl";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "saved", label: "Saved" },
  { value: "search", label: "Search" },
  { value: "stats", label: "Stats" },
];

interface HeaderProps {
  view: View;
  onChangeView: (view: View) => void;
  countLabel: string;
  onTogglePhone: () => void;
  onAddLink: () => void;
  onSignOut: () => void;
}

export function Header({
  view,
  onChangeView,
  countLabel,
  onTogglePhone,
  onAddLink,
  onSignOut,
}: HeaderProps) {
  return (
    <header
      className="grid h-[58px] items-center gap-6 border-b border-[var(--color-divider)] px-[22px]"
      style={{ gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr) auto" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="type-heading text-[19px] uppercase tracking-[.1em]">Forecast</span>
        <span className="text-[10px] uppercase tracking-[.16em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
          reader
        </span>
      </div>

      <div className="flex items-center gap-[14px]">
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={onChangeView} variant="tab" />
        <span className="text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
          {countLabel}
        </span>
      </div>

      <div className="flex items-center gap-[10px]">
        {/* Not in the design — the app still needs an escape hatch to sign out. Kept deliberately minimal. */}
        <button
          type="button"
          onClick={onSignOut}
          className="cursor-pointer border-0 bg-transparent text-[10px] uppercase tracking-[.1em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)] hover:text-[var(--color-accent-700)]"
        >
          Sign out
        </button>
        <button
          type="button"
          onClick={onTogglePhone}
          className="type-heading cursor-pointer border border-[var(--color-divider)] bg-transparent px-3 py-[7px] text-[11px] uppercase tracking-[.09em] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent-700)]"
        >
          Phone
        </button>
        <button
          type="button"
          onClick={onAddLink}
          className="btn-primary text-[12px] uppercase tracking-[.08em]"
        >
          Add link
        </button>
      </div>
    </header>
  );
}
