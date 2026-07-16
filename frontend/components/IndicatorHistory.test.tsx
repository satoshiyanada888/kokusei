import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndicatorHistory } from "./IndicatorHistory";

vi.mock("./TrendChart", () => ({ TrendChart: () => <div data-testid="trend-chart" /> }));

describe("IndicatorHistory", () => {
  it("shows an empty state and does not draw a graph for zero data", () => {
    render(<IndicatorHistory series={[]} unit="万人" />);
    expect(screen.getByRole("heading", { name: "表示できる時系列データがありません" })).toBeInTheDocument();
    expect(screen.queryByTestId("trend-chart")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("preserves the graph for existing data", () => {
    render(<IndicatorHistory unit="万人" series={[{
      value: "1.0", period: "2025年", publishedAt: "2026-01-01", fetchedAt: "2026-01-02",
      sourceUrl: "https://example.test", origin: "official", estimateKind: "final",
    }]} />);
    expect(screen.getByRole("heading", { name: "過去データ" })).toBeInTheDocument();
    expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
  });
});
