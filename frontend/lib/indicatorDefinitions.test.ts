import { describe, expect, expectTypeOf, it } from "vitest";
import { getIndicatorDefinition, type IndicatorDefinition } from "./indicatorDefinitions";

describe("getIndicatorDefinition", () => {
  it.each([
    ["population", "総務省統計局"],
    ["births", "厚生労働省"],
    ["unemployment-rate", "総務省統計局"],
  ])("returns a sourced definition for %s", (slug, sourceName) => {
    const definition = getIndicatorDefinition(slug);
    expect(definition?.definition).toBeTruthy();
    expect(definition?.sourceLabel).toContain(sourceName);
    expect(definition?.sourceUrl).toMatch(/^https:\/\//);
  });

  it("returns no definition for an unregistered slug", () => {
    expect(getIndicatorDefinition("nominal-gdp")).toBeUndefined();
  });

  it("requires the definition field in the typed configuration", () => {
    const minimalDefinition: IndicatorDefinition = { definition: "定義" };
    expectTypeOf(minimalDefinition.definition).toEqualTypeOf<string>();
  });

  it("contains no empty configured text", () => {
    for (const slug of ["population", "births", "unemployment-rate"]) {
      const definition = getIndicatorDefinition(slug);
      expect(definition?.definition.trim()).not.toBe("");
      expect(definition?.interpretation?.trim()).not.toBe("");
      expect(definition?.cautions?.every((caution) => caution.trim().length > 0)).toBe(true);
      expect(definition?.sourceLabel?.trim()).not.toBe("");
      expect(definition?.sourceUrl?.trim()).not.toBe("");
    }
  });
});
