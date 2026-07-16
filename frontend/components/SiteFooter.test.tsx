import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteFooter } from "./SiteFooter";

describe("SiteFooter", () => {
  it("shows site information, existing page links and the copyright year", () => {
    render(<SiteFooter year={2026} />);

    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByText("KOKUSEI")).toBeInTheDocument();
    expect(screen.getByText(/公的機関の一次情報へのリンク/)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "サイト情報" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "このサイトについて" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "データ出典" })).toHaveAttribute("href", "/sources");
    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute("href", "/contact");
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "免責事項" })).toHaveAttribute("href", "/disclaimer");
    expect(screen.getByRole("link", { name: "データ利用方針" })).toHaveAttribute("href", "/data-policy");
    expect(screen.getByText("© 2026 KOKUSEI")).toBeInTheDocument();
    expect(screen.queryByText("準備中")).not.toBeInTheDocument();
  });
});
