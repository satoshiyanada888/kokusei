import type { Indicator } from "@/lib/types";
import { getIndicatorSourceDetail } from "@/lib/indicatorSourceDetails";

const valueNature = (indicator: Indicator): string => {
  if (indicator.developmentData) return "画面・API検証用の開発データです。実際の最新統計として利用できません。";
  if (indicator.latest.estimateKind === "final") return "公的機関が公表した確定値です。";
  if (indicator.latest.estimateKind === "provisional") return "公的機関が公表した概算値です。後日改定される場合があります。";
  return "値の性質は一次情報で確認してください。";
};

export function DataSourceList({ indicators }: { indicators: Indicator[] }) {
  const uniqueIndicators = indicators.filter((indicator, index) =>
    indicators.findIndex(({ slug }) => slug === indicator.slug) === index,
  );

  return <div className="space-y-5">
    {uniqueIndicators.map((indicator) => {
      const detail = getIndicatorSourceDetail(indicator.slug);
      return <article key={indicator.slug} className="panel min-w-0 p-6 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow">{indicator.category}</p>
            <h2 className="mt-2 break-words text-2xl font-bold">{indicator.name}</h2>
          </div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${indicator.developmentData ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
            {indicator.developmentData ? "開発用データ" : "公式データ"}
          </span>
        </div>
        <dl className="mt-6 grid gap-5 sm:grid-cols-2">
          <div><dt className="label">提供機関</dt><dd className="mt-1 break-words">{indicator.sourceName}</dd></div>
          {detail && <div><dt className="label">統計名</dt><dd className="mt-1 break-words">{detail.statisticName}</dd></div>}
          <div className="sm:col-span-2"><dt className="label">利用している値の性質</dt><dd className="mt-1 break-words leading-7">{valueNature(indicator)}</dd></div>
          {detail?.updateNote && <div className="sm:col-span-2"><dt className="label">更新・確定区分</dt><dd className="mt-1 break-words leading-7">{detail.updateNote}</dd></div>}
        </dl>
        <a
          href={indicator.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-block max-w-full break-words font-semibold text-[#176b5b] underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]"
        >{indicator.sourceName}の一次情報を確認する <span aria-hidden="true">↗</span><span className="sr-only">（新しいタブで開きます）</span></a>
      </article>;
    })}
  </div>;
}
