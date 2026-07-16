import { describe, expect, it } from "vitest";
import { calculateIndicatorSummary } from "./calculateIndicatorSummary";

const point = (value: unknown, period: string) => ({ value, period });

describe("calculateIndicatorSummary", () => {
  it("calculates a normal increase", () => {
    const summary = calculateIndicatorSummary([point("100", "2023年"), point("110", "2024年")]);
    expect(summary?.comparison).toEqual({ change: "10", changeRate: "10", rateUnavailable: false, direction: "increase", rateDirection: "increase" });
  });

  it("calculates a normal decrease", () => {
    const summary = calculateIndicatorSummary([point("100", "2023年"), point("80", "2024年")]);
    expect(summary?.comparison).toEqual({ change: "-20", changeRate: "-20", rateUnavailable: false, direction: "decrease", rateDirection: "decrease" });
  });

  it("identifies no change", () => {
    expect(calculateIndicatorSummary([point("5", "2023年"), point("5.0", "2024年")])?.comparison)
      .toEqual({ change: "0", changeRate: "0", rateUnavailable: false, direction: "unchanged", rateDirection: "unchanged" });
  });

  it("does not calculate a rate when the previous value is zero", () => {
    expect(calculateIndicatorSummary([point("0", "2023年"), point("5", "2024年")])?.comparison)
      .toEqual({ change: "5", changeRate: undefined, rateUnavailable: true, direction: "increase", rateDirection: undefined });
  });

  it("omits comparison data when only one value exists", () => {
    const summary = calculateIndicatorSummary([point("12", "2024年")]);
    expect(summary?.latest).toEqual({ value: "12", period: "2024年" });
    expect(summary?.comparison).toBeUndefined();
    expect(summary?.previous).toBeUndefined();
  });

  it("returns no summary when the series is empty", () => {
    expect(calculateIndicatorSummary([])).toBeUndefined();
  });

  it("ignores null and invalid values", () => {
    const summary = calculateIndicatorSummary([
      point(null, "2025年"),
      point("NaN", "2024年"),
      point("7", "2023年"),
    ]);
    expect(summary?.latest).toEqual({ value: "7", period: "2023年" });
  });

  it("finds maximum and minimum values", () => {
    const summary = calculateIndicatorSummary([
      point("8", "2022年"), point("12", "2023年"), point("3", "2024年"),
    ]);
    expect(summary?.maximum).toEqual({ value: "12", period: "2023年" });
    expect(summary?.minimum).toEqual({ value: "3", period: "2024年" });
  });

  it("uses the newest period when extreme values are tied", () => {
    const summary = calculateIndicatorSummary([
      point("2", "2022年"), point("9", "2023年"), point("2.0", "2024年"), point("9.00", "2025年"),
    ]);
    expect(summary?.maximum.period).toBe("2025年");
    expect(summary?.minimum.period).toBe("2024年");
  });

  it("sorts values by period instead of input order", () => {
    const summary = calculateIndicatorSummary([
      point("30", "2024年3月"), point("10", "2024年1月"), point("20", "2024年2月"),
    ]);
    expect(summary?.latest).toEqual({ value: "30", period: "2024年3月" });
    expect(summary?.previous).toEqual({ value: "20", period: "2024年2月" });
  });

  it("calculates values containing negatives", () => {
    const summary = calculateIndicatorSummary([point("-10", "2023年"), point("-5", "2024年")]);
    expect(summary?.comparison).toEqual({ change: "5", changeRate: "-50", rateUnavailable: false, direction: "increase", rateDirection: "decrease" });
    expect(summary?.maximum.value).toBe("-5");
    expect(summary?.minimum.value).toBe("-10");
  });

  it("calculates decimal values without binary floating-point drift", () => {
    const summary = calculateIndicatorSummary([point("0.1", "2023年"), point("0.3", "2024年")]);
    expect(summary?.comparison).toEqual({ change: "0.2", changeRate: "200", rateUnavailable: false, direction: "increase", rateDirection: "increase" });
  });
});
