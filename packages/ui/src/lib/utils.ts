export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(" ");
}

export function formatBigIntWithSpaces(value: bigint): string {
  const isNegative = value < 0n;
  const digits = (isNegative ? -value : value).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return isNegative ? `-${grouped}` : grouped;
}
