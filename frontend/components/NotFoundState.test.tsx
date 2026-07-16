import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NotFoundState } from "./NotFoundState";

describe("NotFoundState", () => {
  it("renders a page 404 with recovery links", () => {
    render(<NotFoundState />);
    expect(screen.getByRole("heading", { level: 1, name: "ページが見つかりません" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "指標一覧を見る" })).toHaveAttribute("href", "/#indicators");
  });

  it("renders an indicator 404 without fabricating an indicator name", () => {
    render(<NotFoundState indicator />);
    expect(screen.getByRole("heading", { level: 1, name: "指標が見つかりません" })).toBeInTheDocument();
    expect(screen.queryByText("架空の指標")).not.toBeInTheDocument();
  });
});
