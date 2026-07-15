import { describe, expect, it } from "vitest";
import { changeLabel, formatValue } from "./format";

describe("formatting", () => {
  it("formats decimal strings without exposing storage scale", () => expect(formatValue("12360.000000")).toBe("12,360"));
  it("labels increases", () => expect(changeLabel("2.700000")).toEqual({ text: "+2.7", tone: "up" }));
  it("handles missing comparisons", () => expect(changeLabel()).toEqual({ text: "比較データなし", tone: "flat" }));
});
