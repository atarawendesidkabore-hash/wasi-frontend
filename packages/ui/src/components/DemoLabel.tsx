import { cn } from "../lib/utils";
import { wasiColors } from "../tokens/colors";

interface DemoLabelProps {
  text?: string;
  className?: string;
}

export function DemoLabel({
  text = "DONNÉES SIMULÉES — NON RÉELLES",
  className,
}: DemoLabelProps) {
  return (
    <div
      role="note"
      className={cn("rounded-md border px-3 py-2 text-xs font-bold tracking-wide", className)}
      style={{
        borderColor: `${wasiColors.danger}66`,
        color: wasiColors.danger,
        backgroundColor: `${wasiColors.danger}14`,
      }}
    >
      {text}
    </div>
  );
}
