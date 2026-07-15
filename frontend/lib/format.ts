export function formatValue(value: string, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits }).format(Number(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

export function changeLabel(change?: string): { text: string; tone: "up" | "down" | "flat" } {
  if (change === undefined) return { text: "比較データなし", tone: "flat" };
  const numeric = Number(change);
  if (numeric > 0) return { text: `+${formatValue(change)}`, tone: "up" };
  if (numeric < 0) return { text: formatValue(change), tone: "down" };
  return { text: "±0", tone: "flat" };
}

