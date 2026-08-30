import { Sun, Cloud, CloudRain } from "lucide-react";
import type { ArticleLevel } from "../../lib/reader";

const LEVEL_ICON = {
  clear: Sun,
  maybe: Cloud,
  rain: CloudRain,
} as const;

const LEVEL_STROKE = {
  clear: "var(--color-accent-700)",
  maybe: "var(--color-neutral-600)",
  rain: "var(--color-neutral-500)",
} as const;

interface WeatherIconProps {
  level: ArticleLevel;
  size: number;
}

export function WeatherIcon({ level, size }: WeatherIconProps) {
  const Icon = LEVEL_ICON[level];
  return (
    <Icon
      width={size}
      height={size}
      color={LEVEL_STROKE[level]}
      strokeWidth={1.5}
      fill="none"
      strokeLinecap="round"
    />
  );
}
