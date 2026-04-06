import { cn } from "../lib/utils";
import { wasiColors } from "../tokens/colors";

type Trend = "up" | "down" | "flat";

interface MetricBadgeProps {
  label: string;
  value: string | number;
  trend?: Trend;
  deltaText?: string;
  className?: string;
}

const trendUi = {
  up: { icon: "▲", color: wasiColors.primary },
  down: { icon: "▼", color: wasiColors.danger },
  flat: { icon: "•", color: wasiColors.warning },
} as const;

export function MetricBadge({
  label,
  value,
  trend = "flat",
  deltaText,
  className,
}: MetricBadgeProps) {
  const ui = trendUi[trend];

  return (
    <div
      className={cn(
        "inline-flex min-w-[180px] flex-col gap-1 rounded-lg border bg-white px-3 py-2 shadow-sm",
        className
      )}
      style={{ borderColor: `${ui.color}66` }}
    >
      <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-xl font-bold leading-none text-slate-900">{value}</span>
      <span className="text-xs font-medium" style={{ color: ui.color }}>
        {ui.icon} {deltaText ?? "Trend"}
      </span>
    </div>
  );
}
