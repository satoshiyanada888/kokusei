import Link from "next/link";

type NotFoundStateProps = {
  indicator?: boolean;
};

export function NotFoundState({ indicator = false }: NotFoundStateProps) {
  const title = indicator ? "指標が見つかりません" : "ページが見つかりません";
  const description = indicator
    ? "指定された指標は存在しないか、URLが変更された可能性があります。"
    : "指定されたページは存在しないか、URLが変更された可能性があります。";

  return <main className="page py-16 md:py-24">
    <section aria-labelledby="not-found-heading" className="panel mx-auto max-w-2xl p-6 text-center md:p-10">
      <p className="eyebrow">Not found</p>
      <h1 id="not-found-heading" className="mt-3 break-words text-3xl font-bold">{title}</h1>
      <p className="mx-auto mt-5 max-w-xl break-words leading-7 text-[#5b6e6c]">{description}</p>
      <nav aria-label="ページが見つからない場合の移動先" className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/" className="min-h-12 rounded-xl bg-[#176b5b] px-6 py-3 font-bold text-white no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">トップページへ戻る</Link>
        <Link href="/#indicators" className="min-h-12 rounded-xl border border-[#176b5b] px-6 py-3 font-bold text-[#176b5b] no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">指標一覧を見る</Link>
      </nav>
    </section>
  </main>;
}
