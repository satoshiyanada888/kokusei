import type { Metadata } from "next";
import type { Indicator } from "./types";
import { buildAbsoluteUrl, siteConfig } from "./siteConfig";

const sharedImages = [
  {
    url: buildAbsoluteUrl(siteConfig.ogImagePath),
    width: 1200,
    height: 630,
    alt: siteConfig.ogImageAlt,
  },
];

export const createHomeMetadata = (): Metadata => ({
  title: { absolute: siteConfig.title },
  description: siteConfig.description,
  alternates: { canonical: buildAbsoluteUrl("/") },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: buildAbsoluteUrl("/"),
    images: sharedImages,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: sharedImages.map(({ url, alt }) => ({ url, alt })),
  },
});

export const createIndicatorMetadata = (indicator: Pick<Indicator, "slug" | "name">): Metadata => {
  const title = `${indicator.name} | ${siteConfig.name}`;
  const description = `日本の${indicator.name}の推移を、政府・公的機関の公式統計をもとにグラフと数値で確認できます。最新値、前回比、統計の説明、一次情報も掲載しています。`;
  const url = buildAbsoluteUrl(`/indicators/${encodeURIComponent(indicator.slug)}`);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title,
      description,
      url,
      images: sharedImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: sharedImages.map(({ url: imageUrl, alt }) => ({ url: imageUrl, alt })),
    },
  };
};

export const missingIndicatorMetadata: Metadata = {
  title: { absolute: `指標が見つかりません | ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export const createStaticPageMetadata = ({
  title: pageTitle,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata => {
  const title = `${pageTitle} | ${siteConfig.name}`;
  const url = buildAbsoluteUrl(path);
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: siteConfig.locale,
      siteName: siteConfig.name,
      title,
      description,
      url,
      images: sharedImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: sharedImages.map(({ url: imageUrl, alt }) => ({ url: imageUrl, alt })),
    },
  };
};
