const LOCAL_SITE_URL = "http://localhost:3000";

export const normalizeSiteUrl = (value?: string): string => {
  const candidate = value?.trim() || LOCAL_SITE_URL;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return LOCAL_SITE_URL;
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return LOCAL_SITE_URL;
  }
};

export const getSiteUrl = (environment: NodeJS.ProcessEnv = process.env): string =>
  normalizeSiteUrl(environment.NEXT_PUBLIC_SITE_URL);

export const buildAbsoluteUrl = (path = "/", baseUrl = siteConfig.url): string => {
  const normalizedPath = path === "/" ? "" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  return `${normalizeSiteUrl(baseUrl)}${normalizedPath || "/"}`;
};

export const siteConfig = {
  name: "KOKUSEI",
  tagline: "日本の統計をわかりやすく",
  socialDescription: "公的統計をグラフと数値で確認",
  title: "KOKUSEI | 日本の統計をわかりやすく",
  description:
    "KOKUSEIは、政府や公的機関の公式統計をもとに、日本の人口、出生数、雇用などの変化をグラフと数値でわかりやすく確認できるサービスです。",
  footerDescription:
    "公的機関の一次情報へのリンクとともに、日本の統計をグラフと数値で確認できるサービスです。",
  locale: "ja_JP",
  language: "ja",
  creator: "KOKUSEI",
  publisher: "KOKUSEI",
  category: "統計",
  url: getSiteUrl(),
  ogImagePath: "/og-image.png",
  ogImageAlt: "KOKUSEI — 日本の統計をわかりやすく",
  repositoryUrl: "https://github.com/satoshiyanada888/kokusei",
  issuesUrl: "https://github.com/satoshiyanada888/kokusei/issues",
} as const;
