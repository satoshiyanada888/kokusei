type SummaryInput = {
  value: unknown;
  period: string;
  publishedAt?: string;
  fetchedAt?: string;
};

type Decimal = {
  coefficient: bigint;
  scale: number;
};

export type SummaryValue = {
  value: string;
  period: string;
};

export type IndicatorComparison = {
  change: string;
  changeRate?: string;
  rateUnavailable: boolean;
  direction: "increase" | "decrease" | "unchanged";
  rateDirection?: "increase" | "decrease" | "unchanged";
};

export type IndicatorSummary = {
  latest: SummaryValue;
  previous?: SummaryValue;
  comparison?: IndicatorComparison;
  maximum: SummaryValue;
  minimum: SummaryValue;
};

const decimalPattern = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const periodPattern = /^(\d{4})年(?:(\d{1,2})月|度)?/;
const rateScale = 6;

function powerOfTen(exponent: number): bigint {
  return BigInt(10) ** BigInt(exponent);
}

function parseDecimal(value: unknown): Decimal | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!decimalPattern.test(trimmed)) return undefined;

  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[+-]/, "");
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const digits = `${whole || "0"}${fraction}`.replace(/^0+(?=\d)/, "");
  const coefficient = BigInt(digits || "0") * (negative ? -BigInt(1) : BigInt(1));
  return { coefficient, scale: fraction.length };
}

function decimalToString(decimal: Decimal): string {
  const negative = decimal.coefficient < BigInt(0);
  const digits = (negative ? -decimal.coefficient : decimal.coefficient).toString().padStart(decimal.scale + 1, "0");
  if (decimal.scale === 0) return `${negative ? "-" : ""}${digits}`;

  const whole = digits.slice(0, -decimal.scale);
  const fraction = digits.slice(-decimal.scale).replace(/0+$/, "");
  if (!fraction) return `${negative ? "-" : ""}${whole}`;
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function alignDecimals(left: Decimal, right: Decimal): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function compareDecimals(left: Decimal, right: Decimal): number {
  const [alignedLeft, alignedRight] = alignDecimals(left, right);
  if (alignedLeft < alignedRight) return -1;
  if (alignedLeft > alignedRight) return 1;
  return 0;
}

function subtractDecimals(left: Decimal, right: Decimal): Decimal {
  const [alignedLeft, alignedRight, scale] = alignDecimals(left, right);
  return { coefficient: alignedLeft - alignedRight, scale };
}

function calculateRate(change: Decimal, previous: Decimal): string | undefined {
  if (previous.coefficient === BigInt(0)) return undefined;

  const numerator = change.coefficient * powerOfTen(previous.scale) * BigInt(100);
  const denominator = previous.coefficient * powerOfTen(change.scale);
  const negative = (numerator < BigInt(0)) !== (denominator < BigInt(0));
  const absoluteNumerator = (numerator < BigInt(0) ? -numerator : numerator) * powerOfTen(rateScale);
  const absoluteDenominator = denominator < BigInt(0) ? -denominator : denominator;
  let quotient = absoluteNumerator / absoluteDenominator;
  const remainder = absoluteNumerator % absoluteDenominator;
  if (remainder * BigInt(2) >= absoluteDenominator) quotient += BigInt(1);

  return decimalToString({ coefficient: negative ? -quotient : quotient, scale: rateScale });
}

function periodOrder(period: string): number | undefined {
  const match = period.trim().match(periodPattern);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = match[2] ? Number(match[2]) : 12;
  if (month < 1 || month > 12) return undefined;
  return year * 12 + month;
}

function timestampOrder(value?: string): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export function calculateIndicatorSummary(series: readonly SummaryInput[]): IndicatorSummary | undefined {
  const valid = series.flatMap((point, index) => {
    const decimal = parseDecimal(point.value);
    return decimal ? [{ point, decimal, index }] : [];
  });
  if (valid.length === 0) return undefined;

  valid.sort((left, right) => {
    const leftPeriod = periodOrder(left.point.period);
    const rightPeriod = periodOrder(right.point.period);
    if (leftPeriod !== undefined && rightPeriod !== undefined && leftPeriod !== rightPeriod) return leftPeriod - rightPeriod;
    const leftPublication = timestampOrder(left.point.publishedAt);
    const rightPublication = timestampOrder(right.point.publishedAt);
    if (leftPublication !== rightPublication) return leftPublication - rightPublication;
    const leftFetch = timestampOrder(left.point.fetchedAt);
    const rightFetch = timestampOrder(right.point.fetchedAt);
    if (leftFetch !== rightFetch) return leftFetch - rightFetch;
    return left.index - right.index;
  });

  const latestEntry = valid[valid.length - 1];
  const previousEntry = valid[valid.length - 2];
  let maximumEntry = valid[0];
  let minimumEntry = valid[0];

  for (const entry of valid.slice(1)) {
    if (compareDecimals(entry.decimal, maximumEntry.decimal) >= 0) maximumEntry = entry;
    if (compareDecimals(entry.decimal, minimumEntry.decimal) <= 0) minimumEntry = entry;
  }

  const toSummaryValue = (entry: typeof latestEntry): SummaryValue => ({
    value: decimalToString(entry.decimal),
    period: entry.point.period,
  });

  const summary: IndicatorSummary = {
    latest: toSummaryValue(latestEntry),
    maximum: toSummaryValue(maximumEntry),
    minimum: toSummaryValue(minimumEntry),
  };

  if (previousEntry) {
    const change = subtractDecimals(latestEntry.decimal, previousEntry.decimal);
    const comparison = compareDecimals(change, { coefficient: BigInt(0), scale: 0 });
    const changeRate = calculateRate(change, previousEntry.decimal);
    const parsedRate = parseDecimal(changeRate);
    const rateComparison = parsedRate
      ? compareDecimals(parsedRate, { coefficient: BigInt(0), scale: 0 })
      : undefined;
    summary.previous = toSummaryValue(previousEntry);
    summary.comparison = {
      change: decimalToString(change),
      changeRate,
      rateUnavailable: changeRate === undefined,
      direction: comparison > 0 ? "increase" : comparison < 0 ? "decrease" : "unchanged",
      rateDirection: rateComparison === undefined
        ? undefined
        : rateComparison > 0 ? "increase" : rateComparison < 0 ? "decrease" : "unchanged",
    };
  }

  return summary;
}
