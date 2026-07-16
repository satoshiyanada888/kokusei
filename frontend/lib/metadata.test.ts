import { describe, expect, it } from "vitest";
import { createHomeMetadata, createIndicatorMetadata, createStaticPageMetadata, missingIndicatorMetadata } from "./metadata";

describe("page metadata", () => {
  it("creates complete home metadata", () => {
    const metadata = createHomeMetadata();

    expect(metadata.title).toEqual({ absolute: "KOKUSEI | 日本の統計をわかりやすく" });
    expect(metadata.description).toContain("政府や公的機関の公式統計");
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/");
    expect(metadata.openGraph).toMatchObject({
      title: "KOKUSEI | 日本の統計をわかりやすく",
      url: "http://localhost:3000/",
      images: [{ url: "http://localhost:3000/og-image.png", width: 1200, height: 630 }],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: [{ url: "http://localhost:3000/og-image.png" }],
    });
  });

  it.each([
    ["population", "総人口"],
    ["births", "出生数"],
    ["unemployment-rate", "完全失業率"],
  ])("creates indicator metadata for %s", (slug, name) => {
    const metadata = createIndicatorMetadata({ slug, name });

    expect(metadata.title).toEqual({ absolute: `${name} | KOKUSEI` });
    expect(metadata.description).toContain(name);
    expect(metadata.alternates?.canonical).toBe(`http://localhost:3000/indicators/${slug}`);
    expect(metadata.openGraph).toMatchObject({
      title: `${name} | KOKUSEI`,
      url: `http://localhost:3000/indicators/${slug}`,
    });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(metadata.openGraph).toMatchObject({
      images: [{ url: "http://localhost:3000/og-image.png" }],
    });
  });

  it("does not create fabricated metadata for a missing indicator", () => {
    expect(missingIndicatorMetadata.alternates).toBeUndefined();
    expect(missingIndicatorMetadata.description).toBeUndefined();
    expect(missingIndicatorMetadata.robots).toEqual({ index: false, follow: false });
  });

  it("creates canonical and Open Graph metadata for an information page", () => {
    const metadata = createStaticPageMetadata({
      title: "このサイトについて",
      description: "KOKUSEIの方針を説明します。",
      path: "/about",
    });
    expect(metadata.title).toEqual({ absolute: "このサイトについて | KOKUSEI" });
    expect(metadata.description).toBe("KOKUSEIの方針を説明します。");
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/about");
    expect(metadata.openGraph).toMatchObject({
      title: "このサイトについて | KOKUSEI",
      url: "http://localhost:3000/about",
      images: [{ url: "http://localhost:3000/og-image.png" }],
    });
  });
});
