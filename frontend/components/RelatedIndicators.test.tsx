import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedIndicators } from "./RelatedIndicators";

describe("RelatedIndicators", () => {
  it("links existing indicators and marks unavailable indicators as upcoming", () => {
    render(<RelatedIndicators indicatorSlug="population" availableSlugs={["births", "unemployment-rate"]} />);

    expect(screen.getByRole("link", { name: /出生数/ })).toHaveAttribute("href", "/indicators/births");
    expect(screen.getByRole("link", { name: /完全失業率/ })).toHaveAttribute("href", "/indicators/unemployment-rate");
    expect(screen.getByText("生産年齢人口").closest("a")).toBeNull();
    expect(screen.getByText("高齢化率").closest("a")).toBeNull();
    expect(screen.getAllByText("準備中")).toHaveLength(2);
  });

  it("renders nothing when an indicator has no related configuration", () => {
    const { container } = render(<RelatedIndicators indicatorSlug="cpi" availableSlugs={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
