import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SiteHeader } from "./SiteHeader";

describe("SiteHeader", () => {
  it("shows the brand link and preserves the existing navigation", () => {
    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "KOKUSEI トップページ" })).toHaveAttribute("href", "/");
    const navigation = screen.getByRole("navigation", { name: "主要ナビゲーション" });
    const dashboardLink = screen.getByRole("link", { name: "ダッシュボード" });
    const updatesLink = screen.getByRole("link", { name: "更新履歴" });
    expect(navigation).toContainElement(dashboardLink);
    expect(dashboardLink).toHaveClass("min-h-11");
    expect(updatesLink).toHaveAttribute("href", "/updates");
    expect(updatesLink).toHaveClass("min-h-11");
    expect(screen.getAllByText("KOKUSEI")).toHaveLength(1);
  });
});
