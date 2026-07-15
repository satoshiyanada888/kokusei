import { describe, expect, it } from "vitest";
import { compactDomain } from "./TrendChart";

describe("compactDomain", () => {
  it("adds padding around a narrow range without forcing zero", () => {
    const domain = compactDomain([12550, 12502, 12457, 12410, 12360]);
    expect(domain[0]).toBeLessThan(12360);
    expect(domain[1]).toBeGreaterThan(12550);
    expect(domain[0]).toBeGreaterThan(0);
  });

  it("creates a visible range for flat data", () => {
    expect(compactDomain([100, 100])).toEqual([95, 105]);
  });
});
