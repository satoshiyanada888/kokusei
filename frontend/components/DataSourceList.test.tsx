import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Indicator } from "@/lib/types";
import { DataSourceList } from "./DataSourceList";

const makeIndicator = (overrides: Partial<Indicator> = {}): Indicator => ({
  slug: "population",
  name: "総人口",
  description: "説明",
  unit: "万人",
  category: "人口",
  sourceName: "総務省統計局",
  sourceUrl: "https://www.stat.go.jp/data/jinsui/",
  latest: {
    value: "12300",
    period: "2025年",
    publishedAt: "2026-01-01",
    fetchedAt: "2026-01-02",
    sourceUrl: "https://www.stat.go.jp/data/jinsui/",
    origin: "official",
    estimateKind: "final",
  },
  developmentData: false,
  ...overrides,
});

describe("DataSourceList", () => {
  it("shows current source facts and a safe external link", () => {
    render(<DataSourceList indicators={[makeIndicator()]} />);

    expect(screen.getByRole("heading", { name: "総人口" })).toBeInTheDocument();
    expect(screen.getByText("総務省統計局")).toBeInTheDocument();
    expect(screen.getByText("人口推計")).toBeInTheDocument();
    expect(screen.getByText("公的機関が公表した確定値です。")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /総務省統計局の一次情報を確認する/ });
    expect(link).toHaveAttribute("href", "https://www.stat.go.jp/data/jinsui/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("distinguishes development data and removes duplicate slugs", () => {
    const development = makeIndicator({ developmentData: true });
    render(<DataSourceList indicators={[development, development]} />);

    expect(screen.getAllByRole("heading", { name: "総人口" })).toHaveLength(1);
    expect(screen.getByText("開発用データ")).toBeInTheDocument();
    expect(screen.getByText(/実際の最新統計として利用できません/)).toBeInTheDocument();
    expect(screen.queryByText("存在しない指標")).not.toBeInTheDocument();
  });
});
