import { render, screen } from "@testing-library/react";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import DataPolicyPage, { metadata as dataPolicyMetadata } from "./data-policy/page";
import DisclaimerPage, { metadata as disclaimerMetadata } from "./disclaimer/page";
import PrivacyPage, { metadata as privacyMetadata } from "./privacy/page";
import TermsPage, { metadata as termsMetadata } from "./terms/page";

const pages = [
  { title: "プライバシーポリシー", path: "/privacy", Page: PrivacyPage, metadata: privacyMetadata },
  { title: "利用規約", path: "/terms", Page: TermsPage, metadata: termsMetadata },
  { title: "免責事項", path: "/disclaimer", Page: DisclaimerPage, metadata: disclaimerMetadata },
  { title: "データ利用方針", path: "/data-policy", Page: DataPolicyPage, metadata: dataPolicyMetadata },
] satisfies { title: string; path: string; Page: () => React.ReactNode; metadata: Metadata }[];

describe("legal pages", () => {
  it.each(pages)("renders $title with headings and document dates", ({ title, Page }) => {
    render(<Page />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText("制定日")).toBeInTheDocument();
    expect(screen.getByText("最終更新日")).toBeInTheDocument();
  });

  it.each(pages)("defines unique metadata for $title", ({ title, path, metadata }) => {
    expect(metadata.description).toBeTruthy();
    expect(metadata.title).toEqual({ absolute: `${title} | KOKUSEI` });
    expect(metadata.alternates?.canonical).toBe(`http://localhost:3000${path}`);
    expect(metadata.openGraph).toMatchObject({
      title: `${title} | KOKUSEI`,
      url: `http://localhost:3000${path}`,
    });
  });

  it("states current privacy behavior without claiming unimplemented tracking", () => {
    render(<PrivacyPage />);
    expect(screen.getByText(/アクセス解析サービスおよび外部エラー監視サービスは導入していません/)).toBeInTheDocument();
    expect(screen.getByText(/利用者の識別、広告、アクセス解析を目的とするCookieを設定していません/)).toBeInTheDocument();
    expect(screen.getAllByText(/公開GitHub Issues/).length).toBeGreaterThan(0);
  });

  it("distinguishes public statistics from KOKUSEI rights", () => {
    render(<TermsPage />);
    expect(screen.getByText(/KOKUSEIは公的統計そのものの権利を保有しません/)).toBeInTheDocument();
    expect(screen.getByText(/LICENSEファイルがありません/)).toBeInTheDocument();
  });

  it("does not completely guarantee accuracy or present related indicators as causation", () => {
    render(<DisclaimerPage />);
    expect(screen.getByText(/正確性、完全性、最新性を完全には保証しません/)).toBeInTheDocument();
    expect(screen.getByText(/因果関係を示すものではありません/)).toBeInTheDocument();
    expect(screen.getByText(/一次情報を優先してください/)).toBeInTheDocument();
  });

  it("links only to configured official usage policies with safe external-link attributes", () => {
    render(<DataPolicyPage />);
    const externalLinks = screen.getAllByRole("link", { name: /新しいタブで開きます/ });
    expect(externalLinks.length).toBeGreaterThanOrEqual(4);
    externalLinks.forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link.getAttribute("href")).toMatch(/^https:\/\//);
    });
    expect(screen.getByText(/因果関係や評価を示しません/)).toBeInTheDocument();
  });
});
