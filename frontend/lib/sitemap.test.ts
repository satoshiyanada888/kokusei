import { describe, expect, it } from "vitest";
import { createSitemap } from "./sitemap";

const indicator = (slug: string) => ({
  slug,
  latest: {
    value: "1",
    period: "2026-01",
    publishedAt: "2026-02-01",
    fetchedAt: "2026-02-02",
    sourceUrl: "https://example.go.jp",
    origin: "official" as const,
    estimateKind: "final" as const,
  },
});

describe("createSitemap", () => {
  it("includes public static pages and existing indicators only", () => {
    const entries = createSitemap([indicator("population"), indicator("births")]);
    const urls = entries.map(({ url }) => url);

    expect(urls).toContain("http://localhost:3000/");
    expect(urls).toContain("http://localhost:3000/updates");
    expect(urls).toContain("http://localhost:3000/about");
    expect(urls).toContain("http://localhost:3000/sources");
    expect(urls).toContain("http://localhost:3000/contact");
    expect(urls).toContain("http://localhost:3000/privacy");
    expect(urls).toContain("http://localhost:3000/terms");
    expect(urls).toContain("http://localhost:3000/disclaimer");
    expect(urls).toContain("http://localhost:3000/data-policy");
    expect(urls).toContain("http://localhost:3000/indicators/population");
    expect(urls).toContain("http://localhost:3000/indicators/births");
    expect(urls).not.toContain("http://localhost:3000/indicators/unknown");
    expect(urls.every((url) => URL.canParse(url))).toBe(true);
  });

  it("does not emit duplicate URLs", () => {
    const urls = createSitemap([indicator("population"), indicator("population")]).map(({ url }) => url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("omits lastModified when the published date is invalid", () => {
    const entry = createSitemap([{ ...indicator("population"), latest: { ...indicator("population").latest, publishedAt: "" } }])
      .find(({ url }) => url.endsWith("/indicators/population"));
    expect(entry?.lastModified).toBeUndefined();
  });
});
