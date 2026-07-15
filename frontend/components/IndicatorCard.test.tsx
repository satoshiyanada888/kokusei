import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IndicatorCard } from "./IndicatorCard";

vi.mock("./TrendChart", () => ({ TrendChart: () => <div data-testid="trend" /> }));

describe("IndicatorCard", () => {
  it("shows the value, period, source navigation and change", () => {
    render(<IndicatorCard indicator={{
      slug: "population", name: "総人口", description: "desc", unit: "万人", category: "人口",
      sourceName: "総務省統計局", sourceUrl: "https://example.test", developmentData: true,
      latest: { value: "12360.000000", period: "2024年（開発用）", publishedAt: "2025-01-31", fetchedAt: "2025-01-31T00:00:00Z" },
      previous: { value: "12410.000000", period: "2023年", publishedAt: "2024-01-31", fetchedAt: "2024-01-31T00:00:00Z" }, change: "-50.000000",
    }} />);
    expect(screen.getByText("総人口")).toBeInTheDocument();
    expect(screen.getByText(/12,360/)).toBeInTheDocument();
    expect(screen.getByText(/前回比 -50/)).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/indicators/population");
  });
});

