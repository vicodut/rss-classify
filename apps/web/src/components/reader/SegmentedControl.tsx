import { cn } from "../../lib/cn";

interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** "tab" = header/phone view switcher (heading font, uppercase). "filter" = search filter row (body font). */
  variant?: "tab" | "filter";
  tabular?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "filter",
  tabular = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex border border-[var(--color-divider)]", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "cursor-pointer border-0 border-l border-l-[var(--color-divider)] hover:opacity-[.78]",
              variant === "tab"
                ? "type-heading px-[15px] py-2 text-[12px] uppercase tracking-[.09em]"
                : "px-3 py-[6px] text-[12px]",
              tabular && "tabular-nums",
              active
                ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                : "bg-transparent text-[color-mix(in_srgb,var(--color-text)_68%,transparent)]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
