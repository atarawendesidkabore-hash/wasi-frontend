import { cn } from "../lib/utils";
import { wasiColors } from "../tokens/colors";

export type CreditGrade = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC" | "D";

interface CreditGradeBadgeProps {
  grade: CreditGrade;
  className?: string;
}

const gradeColor: Record<CreditGrade, string> = {
  AAA: wasiColors.primary,
  AA: wasiColors.primary,
  A: "#2f9e64",
  BBB: wasiColors.warning,
  BB: "#f97316",
  B: "#fb7185",
  CCC: wasiColors.danger,
  D: "#7f1d1d",
};

export function CreditGradeBadge({ grade, className }: CreditGradeBadgeProps) {
  const color = gradeColor[grade];

  return (
    <span
      className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold", className)}
      style={{
        borderColor: `${color}66`,
        color,
        backgroundColor: `${color}14`,
      }}
    >
      {grade}
    </span>
  );
}
