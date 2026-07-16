import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ContactPage from "./page";

describe("ContactPage", () => {
  it("shows the verified GitHub Issues contact without a fabricated email address", () => {
    render(<ContactPage />);

    expect(screen.getByRole("heading", { level: 1, name: "お問い合わせ" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /KOKUSEIのGitHub Issuesを開く/ });
    expect(link).toHaveAttribute("href", "https://github.com/satoshiyanada888/kokusei/issues");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(document.body.textContent).not.toMatch(/[\w.+-]+@[\w.-]+/);
    expect(screen.getByText(/問い合わせフォーム、公開メールアドレス/)).toBeInTheDocument();
  });
});
