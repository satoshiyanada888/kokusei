import { describe, expect, it } from "vitest";
import { getIndicatorSourceDetail } from "./indicatorSourceDetails";

describe("indicator source details", () => {
  it.each([
    ["population", "人口推計"],
    ["births", "人口動態統計"],
    ["nominal-gdp", "国民経済計算（GDP統計）"],
    ["cpi", "消費者物価指数（CPI）"],
    ["unemployment-rate", "労働力調査"],
  ])("returns the verified statistic name for %s", (slug, name) => {
    expect(getIndicatorSourceDetail(slug)?.statisticName).toBe(name);
  });

  it("does not invent details for an unknown slug", () => {
    expect(getIndicatorSourceDetail("unknown")).toBeUndefined();
  });
});
