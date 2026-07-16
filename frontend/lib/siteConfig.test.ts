import { describe, expect, it } from "vitest";
import { buildAbsoluteUrl, getSiteUrl, normalizeSiteUrl, siteConfig } from "./siteConfig";

describe("siteConfig", () => {
  it("uses NEXT_PUBLIC_SITE_URL when configured", () => {
    expect(getSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://kokusei.example" })).toBe("https://kokusei.example");
  });

  it("falls back to localhost when the environment variable is missing", () => {
    expect(getSiteUrl({})).toBe("http://localhost:3000");
  });

  it("normalizes a trailing slash", () => {
    expect(normalizeSiteUrl("https://kokusei.example/")).toBe("https://kokusei.example");
  });

  it("joins canonical paths without duplicate slashes", () => {
    expect(buildAbsoluteUrl("/indicators/population", "https://kokusei.example/")).toBe(
      "https://kokusei.example/indicators/population",
    );
    expect(buildAbsoluteUrl("/", "https://kokusei.example/")).toBe("https://kokusei.example/");
  });

  it("centralizes the shared brand copy and social image", () => {
    expect(siteConfig.name).toBe("KOKUSEI");
    expect(siteConfig.tagline).toBe("日本の統計をわかりやすく");
    expect(siteConfig.socialDescription).toBe("公的統計をグラフと数値で確認");
    expect(siteConfig.ogImagePath).toBe("/og-image.png");
  });
});
