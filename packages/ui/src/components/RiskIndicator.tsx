import { cn } from "../lib/utils";
import { wasiColors } from "../tokens/colors";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface RiskIndicatorProps {
  level: RiskLevel;
  className?: string;
}

const riskColor: Record<RiskLevel, string> = {
  LOW: wasiColors.primary,
  MEDIUM: wasiColors.warning,
  HIGH: "#ea580c",
  CRITICAL: wasiColors.danger,
};

export function RiskIndicator({ level, className }: RiskIndicatorProps) {
  const color = riskColor[level];

  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", className)}>
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{level}</span>
    </span>
  );
}
