import { cn, formatBigIntWithSpaces } from "../lib/utils";

interface CurrencyDisplayProps {
  amount: bigint;
  currency?: "XOF" | "USD" | "EUR" | string;
  className?: string;
}

export function CurrencyDisplay({
  amount,
  currency = "XOF",
  className,
}: CurrencyDisplayProps) {
  return (
    <span className={cn("font-mono text-sm font-semibold text-slate-900", className)}>
      {formatBigIntWithSpaces(amount)} {currency}
    </span>
  );
}
