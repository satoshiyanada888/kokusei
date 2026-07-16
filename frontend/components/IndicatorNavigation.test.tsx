import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IndicatorNavigation } from "./IndicatorNavigation";

afterEach(cleanup);

describe("IndicatorNavigation", () => {
  it("shows previous and next indicators", () => {
    render(<IndicatorNavigation
      currentSlug="cpi"
      previous={{ slug: "nominal-gdp", name: "名目GDP" }}
      next={{ slug: "unemployment-rate", name: "完全失業率" }}
    />);

    expect(screen.getByRole("link", { name: "← 前の指標 名目GDP" })).toHaveAttribute("href", "/indicators/nominal-gdp");
    expect(screen.getByRole("link", { name: "次の指標 → 完全失業率" })).toHaveAttribute("href", "/indicators/unemployment-rate");
  });

  it("does not show a previous link for the first indicator", () => {
    render(<IndicatorNavigation currentSlug="population" next={{ slug: "births", name: "出生数" }} />);
    expect(screen.queryByText("← 前の指標")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "次の指標 → 出生数" })).toBeInTheDocument();
  });

  it("does not show a next link for the last indicator", () => {
    render(<IndicatorNavigation currentSlug="unemployment-rate" previous={{ slug: "cpi", name: "消費者物価指数" }} />);
    expect(screen.queryByText("次の指標 →")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "← 前の指標 消費者物価指数" })).toBeInTheDocument();
  });

  it("always shows the indicator list link", () => {
    render(<IndicatorNavigation currentSlug="population" />);
    expect(screen.getByRole("link", { name: "指標一覧へ戻る" })).toHaveAttribute("href", "/");
  });

  it("does not link to the current indicator or an invalid slug", () => {
    render(<IndicatorNavigation
      currentSlug="cpi"
      previous={{ slug: "cpi", name: "消費者物価指数" }}
      next={{ slug: "../missing", name: "無効な指標" }}
    />);

    expect(screen.queryByRole("link", { name: "← 前の指標 消費者物価指数" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "次の指標 → 無効な指標" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});
