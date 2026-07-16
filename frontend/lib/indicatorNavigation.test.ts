import { describe, expect, it } from "vitest";
import { getAdjacentIndicators } from "./indicatorNavigation";

const indicators = [
  { slug: "population", name: "総人口" },
  { slug: "births", name: "出生数" },
  { slug: "nominal-gdp", name: "名目GDP" },
];

describe("getAdjacentIndicators", () => {
  it("uses the order supplied by the indicator list", () => {
    expect(getAdjacentIndicators(indicators, "births")).toEqual({
      previous: indicators[0],
      next: indicators[2],
    });
  });

  it("returns no links when the current slug is absent", () => {
    expect(getAdjacentIndicators(indicators, "missing")).toEqual({});
  });
});
