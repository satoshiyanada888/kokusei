import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalPageLayout } from "./LegalPageLayout";

describe("LegalPageLayout", () => {
  it("renders one page heading, fixed document dates and a return link", () => {
    render(<LegalPageLayout eyebrow="Policy" title="方針" introduction="説明"><section><h2>内容</h2></section></LegalPageLayout>);

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "方針" })).toBeInTheDocument();
    expect(screen.getByText("制定日")).toBeInTheDocument();
    expect(screen.getAllByText("2026年7月15日")).toHaveLength(2);
    const returnLink = screen.getByRole("link", { name: "← トップページへ戻る" });
    expect(returnLink).toHaveAttribute("href", "/");
    expect(returnLink).toHaveClass("min-h-11");
  });
});
