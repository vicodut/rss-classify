import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import type { View } from "../../lib/reader";
import { cn } from "../../lib/cn";
import { SegmentedControl } from "./SegmentedControl";

const VIEW_OPTIONS: { value: View; label: string }[] = [
  { value: "forecast", label: "Forecast" },
  { value: "pool", label: "Pool" },
  { value: "saved", label: "Saved" },
  { value: "search", label: "Search" },
  { value: "stats", label: "Stats" },
  { value: "classify", label: "Classify" },
  { value: "feeds", label: "Feeds" },
];

interface HeaderProps {
  view: View;
  onChangeView: (view: View) => void;
  countLabel: string;
  onAddLink: () => void;
  onSignOut: () => void;
}

function Logo() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="type-heading text-[19px] uppercase tracking-[.1em]">Forecast</span>
      <span className="text-[10px] uppercase tracking-[.16em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)]">
        reader
      </span>
    </div>
  );
}

function Actions({ onAddLink, onSignOut }: Pick<HeaderProps, "onAddLink" | "onSignOut">) {
  return (
    <div className="flex items-center gap-[10px]">
      {/* Not in the design — the app still needs an escape hatch to sign out. Kept deliberately minimal. */}
      <button
        type="button"
        onClick={onSignOut}
        className="cursor-pointer border-0 bg-transparent text-[10px] uppercase tracking-[.1em] text-[color-mix(in_srgb,var(--color-text)_42%,transparent)] hover:text-[var(--color-accent-700)]"
      >
        Sign out
      </button>
      <button type="button" onClick={onAddLink} className="btn-primary text-[12px] uppercase tracking-[.08em]">
        Add link
      </button>
    </div>
  );
}

function Nav({ view, onChangeView, countLabel }: Pick<HeaderProps, "view" | "onChangeView" | "countLabel">) {
  return (
    <div className="min-w-0 flex items-center gap-[14px] overflow-x-auto">
      <SegmentedControl
        options={VIEW_OPTIONS}
        value={view}
        onChange={onChangeView}
        variant="tab"
        className="flex-none"
      />
      <span className="hidden flex-none text-[11px] uppercase tracking-[.08em] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] sm:inline">
        {countLabel}
      </span>
    </div>
  );
}

interface MobileMenuProps {
  view: View;
  onSelectView: (view: View) => void;
  onAddLink: () => void;
  onSignOut: () => void;
  onClose: () => void;
}

/** Fullscreen — covers the entire viewport rather than a dropdown/drawer, so it's unambiguous when it's open and easy to reach every action with a thumb. */
function MobileMenu({ view, onSelectView, onAddLink, onSignOut, onClose }: MobileMenuProps) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)] md:hidden">
      <div className="flex items-center justify-between border-b border-[var(--color-divider)] px-[16px] py-[10px]">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="grid h-9 w-9 cursor-pointer place-items-center border border-[var(--color-divider)] bg-transparent"
        >
          <X size={20} strokeWidth={1.5} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto">
        {VIEW_OPTIONS.map((opt) => {
          const active = opt.value === view;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelectView(opt.value)}
              className={cn(
                "type-heading block w-full cursor-pointer border-0 border-b border-[color-mix(in_srgb,var(--color-text)_8%,transparent)] px-[20px] py-[18px] text-left text-[18px] uppercase tracking-[.08em]",
                active
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                  : "bg-transparent text-[var(--color-text)]",
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-[10px] border-t border-[var(--color-divider)] p-[16px]">
        <button
          type="button"
          onClick={onAddLink}
          className="btn-primary w-full text-center text-[13px] uppercase tracking-[.08em]"
        >
          Add link
        </button>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full cursor-pointer border border-[var(--color-divider)] bg-transparent px-3 py-[10px] text-[12px] uppercase tracking-[.09em] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/**
 * Two full layouts, toggled by breakpoint rather than one grid with reordered
 * items — a single reordered-via-CSS-order grid looked simpler but is easy
 * to get subtly wrong (auto-placement + `order` interacting badly across
 * `display: contents` boundaries); two small explicit layouts are safer to
 * reason about and verify. Mobile drops the inline scrollable tab strip in
 * favor of a hamburger trigger + fullscreen menu (view switcher, Add link,
 * Sign out) — a compact top bar plus one unambiguous full-viewport menu
 * beats a horizontally-scrolling 7-tab strip on a phone.
 */
export function Header({ view, onChangeView, countLabel, onAddLink, onSignOut }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function selectView(v: View) {
    onChangeView(v);
    setMenuOpen(false);
  }

  return (
    <header className="min-w-0 border-b border-[var(--color-divider)] px-[16px] py-[10px] md:px-[22px] md:py-0">
      <div className="flex items-center justify-between gap-3 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open menu"
          className="grid h-9 w-9 cursor-pointer place-items-center border border-[var(--color-divider)] bg-transparent"
        >
          <Menu size={20} strokeWidth={1.5} />
        </button>
      </div>

      <div className="hidden min-w-0 md:grid md:h-[58px] md:grid-cols-[minmax(180px,240px)_minmax(0,1fr)_auto] md:items-center md:gap-6">
        <Logo />
        <Nav view={view} onChangeView={onChangeView} countLabel={countLabel} />
        <Actions onAddLink={onAddLink} onSignOut={onSignOut} />
      </div>

      {menuOpen && (
        <MobileMenu
          view={view}
          onSelectView={selectView}
          onAddLink={() => {
            setMenuOpen(false);
            onAddLink();
          }}
          onSignOut={() => {
            setMenuOpen(false);
            onSignOut();
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}
