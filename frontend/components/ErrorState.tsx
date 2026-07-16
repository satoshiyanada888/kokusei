"use client";

import Link from "next/link";
import { RetryButton } from "./RetryButton";

type ErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = "データを読み込めませんでした",
  description = "現在、データを表示できません。時間をおいて、もう一度お試しください。",
  onRetry,
}: ErrorStateProps) {
  return <main className="page py-16 md:py-24">
    <section
      role="alert"
      aria-labelledby="error-state-heading"
      className="panel mx-auto max-w-2xl p-6 text-center md:p-10"
    >
      <p className="eyebrow">Unable to display</p>
      <h1 id="error-state-heading" className="mt-3 break-words text-3xl font-bold">{title}</h1>
      <p className="mx-auto mt-5 max-w-xl break-words leading-7 text-[#5b6e6c]">{description}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:flex-wrap">
        {onRetry && <RetryButton onRetry={onRetry} />}
        <Link href="/" className="min-h-12 rounded-xl border border-[#176b5b] px-6 py-3 font-bold text-[#176b5b] no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">トップページへ戻る</Link>
        <Link href="/#indicators" className="min-h-12 rounded-xl border border-[#dce5df] px-6 py-3 font-bold no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">指標一覧を見る</Link>
      </div>
    </section>
  </main>;
}
