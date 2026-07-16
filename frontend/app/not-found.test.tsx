import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

describe("NotFound page", () => {
  it("renders recovery links and prevents indexing", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "ページが見つかりません" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");
    expect(metadata.title).toEqual({ absolute: "ページが見つかりません | KOKUSEI" });
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
