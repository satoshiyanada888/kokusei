import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TrendChart } from "./TrendChart";

const series = [{
  id: 1,
  value: "100",
  period: "2026年",
  publishedAt: "2026-01-01",
  fetchedAt: "2026-01-02",
  sourceUrl: "https://example.go.jp",
  origin: "official" as const,
  estimateKind: "final" as const,
}];

describe("TrendChart accessibility", () => {
  it("exposes the detailed chart as one labelled graphic", () => {
    render(<TrendChart series={series} />);
    expect(screen.getByRole("img", { name: "過去データの折れ線グラフ" })).toBeInTheDocument();
  });

  it("exposes the compact chart as one labelled graphic", () => {
    render(<TrendChart series={series} compact />);
    expect(screen.getByRole("img", { name: "簡易トレンド" })).toBeInTheDocument();
  });
});
