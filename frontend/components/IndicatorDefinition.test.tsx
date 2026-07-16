import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IndicatorDefinition } from "./IndicatorDefinition";

afterEach(cleanup);

const completeDefinition = {
  definition: "指標の定義です。",
  interpretation: "数字の読み方です。",
  cautions: ["比較時の注意点です。"],
  sourceLabel: "公的機関の資料",
  sourceUrl: "https://example.go.jp/statistics",
};

describe("IndicatorDefinition", () => {
  it("shows definition, interpretation and cautions", () => {
    render(<IndicatorDefinition definition={completeDefinition} />);
    expect(screen.getByRole("heading", { name: "この指標とは" })).toBeInTheDocument();
    expect(screen.getByText("指標の定義です。")).toBeInTheDocument();
    expect(screen.getByText("数字の読み方です。")).toBeInTheDocument();
    expect(screen.getByText("比較時の注意点です。")).toBeInTheDocument();
  });

  it("omits headings for optional content that is not configured", () => {
    render(<IndicatorDefinition definition={{ definition: "定義だけです。" }} />);
    expect(screen.getByText("定義だけです。")).toBeInTheDocument();
    expect(screen.queryByText("数字の読み方")).not.toBeInTheDocument();
    expect(screen.queryByText("比較するときの注意点")).not.toBeInTheDocument();
  });

  it("renders nothing without definition data", () => {
    const { container } = render(<IndicatorDefinition />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses safe attributes for an external source link", () => {
    render(<IndicatorDefinition definition={completeDefinition} />);
    const link = screen.getByRole("link", { name: /定義の根拠/ });
    expect(link).toHaveAttribute("href", completeDefinition.sourceUrl);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
