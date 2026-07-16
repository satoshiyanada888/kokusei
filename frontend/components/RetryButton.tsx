"use client";

import { useState } from "react";

type RetryButtonProps = {
  onRetry: () => void | Promise<void>;
};

export function RetryButton({ onRetry }: RetryButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const retry = async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await onRetry();
    } finally {
      setIsPending(false);
    }
  };

  return <button
    type="button"
    onClick={retry}
    disabled={isPending}
    aria-busy={isPending}
    className="min-h-12 rounded-xl bg-[#176b5b] px-6 py-3 font-bold text-white transition hover:bg-[#105548] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b] disabled:cursor-wait disabled:opacity-60"
  >
    {isPending ? "再試行しています…" : "もう一度試す"}
  </button>;
}
