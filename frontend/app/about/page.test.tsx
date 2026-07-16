import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage from "./page";

describe("AboutPage", () => {
  it("describes the mission, public-data policy and treatment of causality", () => {
    render(<AboutPage />);

    expect(screen.getByRole("heading", { level: 1, name: "このサイトについて" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "目的" })).toBeInTheDocument();
    expect(screen.getByText(/公的機関が公開する一次情報/)).toBeInTheDocument();
    expect(screen.getByText(/因果関係、評価、将来予測は断定しません/)).toBeInTheDocument();
    expect(screen.queryByText(/AI分析|日本最大|国内初/)).not.toBeInTheDocument();
  });
});
