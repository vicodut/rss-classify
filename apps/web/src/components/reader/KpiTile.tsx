import type { Kpi } from "../../lib/reader-stats";

interface KpiTileProps {
  kpi: Kpi;
  valueSize?: number;
  padding?: string;
}

export function KpiTile({ kpi, valueSize = 40, padding = "px-[18px] pt-4 pb-[14px]" }: KpiTileProps) {
  return (
    <div className={`blueprint ${padding}`}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      <div className="text-[10px] uppercase tracking-[.14em] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
        {kpi.label}
      </div>
      <div
        className="type-heading mt-[6px] leading-[1.05] tabular-nums"
        style={{ fontSize: `${valueSize}px` }}
      >
        {kpi.value}
      </div>
      <div className="text-[11px] text-[var(--color-accent-700)]">{kpi.note}</div>
    </div>
  );
}
