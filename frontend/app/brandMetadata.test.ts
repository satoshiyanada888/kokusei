import { describe, expect, it } from "vitest";
import { metadata } from "./layout";

describe("root brand metadata", () => {
  it("references the favicon and Apple Touch Icon", () => {
    expect(metadata.icons).toEqual({
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    });
  });

  it("uses the same absolute PNG for Open Graph and Twitter Card", () => {
    expect(metadata.openGraph).toMatchObject({
      images: [{
        url: "http://localhost:3000/og-image.png",
        width: 1200,
        height: 630,
        alt: "KOKUSEI — 日本の統計をわかりやすく",
      }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{
        url: "http://localhost:3000/og-image.png",
        alt: "KOKUSEI — 日本の統計をわかりやすく",
      }],
    });
  });
});
