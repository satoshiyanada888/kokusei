import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandSymbol, SiteLogo } from "./SiteLogo";

describe("SiteLogo", () => {
  it("links the visible site name to the home page with an accessible name", () => {
    render(<SiteLogo />);

    const link = screen.getByRole("link", { name: "KOKUSEI トップページ" });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveTextContent("KOKUSEI");
    expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the standalone symbol decorative", () => {
    const { container } = render(<BrandSymbol />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
