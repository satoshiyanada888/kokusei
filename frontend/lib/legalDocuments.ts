export const legalDocumentDates = {
  effectiveDate: "2026年7月15日",
  lastUpdated: "2026年7月15日",
} as const;

export type PublicDataTerm = {
  label: string;
  url: string;
};

export const publicDataTerms = [
  { label: "政府統計の総合窓口（e-Stat）利用規約", url: "https://www.e-stat.go.jp/terms-of-use" },
  { label: "総務省統計局 サイトの利用について", url: "https://www.stat.go.jp/info/riyou.html" },
  { label: "厚生労働省 利用規約・リンク・著作権等", url: "https://www.mhlw.go.jp/chosakuken/index.html" },
  { label: "内閣府ホームページ利用規約", url: "https://www.cao.go.jp/notice/rule.html" },
] as const satisfies readonly PublicDataTerm[];
