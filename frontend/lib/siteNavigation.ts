export type SiteNavigationItem = {
  href: string;
  label: string;
};

export const footerNavigation = [
  { href: "/about", label: "このサイトについて" },
  { href: "/sources", label: "データ出典" },
  { href: "/contact", label: "お問い合わせ" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/terms", label: "利用規約" },
  { href: "/disclaimer", label: "免責事項" },
  { href: "/data-policy", label: "データ利用方針" },
] as const satisfies readonly SiteNavigationItem[];
