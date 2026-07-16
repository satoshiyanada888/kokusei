import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IndicatorSummary } from "./IndicatorSummary";
import type { IndicatorSummary as IndicatorSummaryData } from "@/lib/calculateIndicatorSummary";

afterEach(cleanup);

const summary: IndicatorSummaryData = {
  latest: { value: "110.5", period: "2024年" },
  previous: { value: "100", period: "2023年" },
  comparison: { change: "10.5", changeRate: "10.5", rateUnavailable: false, direction: "increase", rateDirection: "increase" },
  maximum: { value: "110.5", period: "2024年" },
  minimum: { value: "90", period: "2022年" },
};

describe("IndicatorSummary", () => {
  it("shows the latest value and unit", () => {
    render(<IndicatorSummary summary={summary} unit="万人" />);
    expect(screen.getAllByText(/110.5/)).not.toHaveLength(0);
    expect(screen.getAllByText("万人")).not.toHaveLength(0);
    expect(screen.getByText("最新値").parentElement).toHaveTextContent("2024年");
  });

  it("shows change value, rate and a textual direction", () => {
    render(<IndicatorSummary summary={summary} unit="万人" />);
    expect(screen.getByText("直前からの増減値").parentElement).toHaveTextContent("増加 +10.5 万人");
    expect(screen.getByText("直前からの増減率").parentElement).toHaveTextContent("増加 +10.5%");
  });

  it("omits previous comparison cards for one value", () => {
    render(<IndicatorSummary summary={{ latest: summary.latest, maximum: summary.latest, minimum: summary.latest }} unit="指数" />);
    expect(screen.queryByText("直前からの増減値")).not.toBeInTheDocument();
    expect(screen.queryByText("直前からの増減率")).not.toBeInTheDocument();
    expect(screen.getAllByText("指数")).not.toHaveLength(0);
  });

  it("does not render without valid data", () => {
    const { container } = render(<IndicatorSummary unit="%" />);
    expect(container).toBeEmptyDOMElement();
  });
});
