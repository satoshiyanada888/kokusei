import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("shows recovery actions without exposing internal error details", () => {
    render(<ErrorState onRetry={() => undefined} />);

    expect(screen.getByRole("heading", { level: 1, name: "データを読み込めませんでした" })).toBeInTheDocument();
    expect(screen.getByText(/現在、データを表示できません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "もう一度試す" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "トップページへ戻る" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "指標一覧を見る" })).toHaveAttribute("href", "/#indicators");
    expect(screen.queryByText(/stack|DATABASE_URL|internal/i)).not.toBeInTheDocument();
  });

  it("calls retry and disables repeated attempts while retrying", async () => {
    let finishRetry: (() => void) | undefined;
    const onRetry = vi.fn(() => new Promise<void>((resolve) => { finishRetry = resolve; }));
    render(<ErrorState onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    const pendingButton = screen.getByRole("button", { name: "再試行しています…" });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(pendingButton).toBeDisabled();
    expect(pendingButton).toHaveAttribute("aria-busy", "true");
    fireEvent.click(pendingButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    finishRetry?.();
    await waitFor(() => expect(screen.getByRole("button", { name: "もう一度試す" })).toBeEnabled());
  });

  it("omits retry when no handler is provided", () => {
    render(<ErrorState title="問題が発生しました" description="現在表示できません。" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
