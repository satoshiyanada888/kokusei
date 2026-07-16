import { describe, expect, it } from "vitest";
import { getRelatedIndicators } from "./relatedIndicators";

describe("getRelatedIndicators", () => {
  it("keeps population relationships in domain configuration", () => {
    expect(getRelatedIndicators("population").map(({ slug }) => slug)).toEqual([
      "births",
      "working-age-population",
      "aging-rate",
      "unemployment-rate",
    ]);
  });
});
