import { describe, expect, it } from "vitest";
import { legalDocumentDates, publicDataTerms } from "./legalDocuments";

describe("legal documents configuration", () => {
  it("uses explicit dates instead of build-time values", () => {
    expect(legalDocumentDates).toEqual({
      effectiveDate: "2026年7月15日",
      lastUpdated: "2026年7月15日",
    });
  });

  it("contains unique, secure official usage-policy URLs", () => {
    const urls = publicDataTerms.map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.every((url) => URL.canParse(url) && url.startsWith("https://"))).toBe(true);
    expect(urls).toContain("https://www.e-stat.go.jp/terms-of-use");
  });
});
