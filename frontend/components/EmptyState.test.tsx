import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("shows an empty state without error or retry controls", () => {
    render(<EmptyState description="現在、表示できる指標が登録されていません。" />);

    expect(screen.getByRole("heading", { name: "表示できるデータがありません" })).toBeInTheDocument();
    expect(screen.getByText("現在、表示できる指標が登録されていません。")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("does not render an empty optional description", () => {
    const { container } = render(<EmptyState />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});
