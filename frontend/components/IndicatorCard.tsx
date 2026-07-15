import Link from "next/link";
import { Indicator } from "@/lib/types";
import { changeLabel, formatDate, formatValue } from "@/lib/format";
import { TrendChart } from "./TrendChart";

export function IndicatorCard({ indicator }: { indicator: Indicator }) {
  const change = changeLabel(indicator.change);
  const series = indicator.series?.length ? indicator.series : [indicator.previous, indicator.latest].filter(Boolean) as Indicator["series"];
  return <Link href={`/indicators/${indicator.slug}`} className="panel group block p-6 no-underline transition hover:-translate-y-0.5 hover:border-[#93b8ae]">
    <div className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,45%)] sm:items-start sm:gap-6">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="eyebrow">{indicator.category}</p><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${indicator.developmentData ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{indicator.developmentData ? "開発用" : "公式・確定値"}</span></div><h2 className="mt-2 text-xl font-bold">{indicator.name}</h2>
        <p className="mt-6 text-3xl font-bold tracking-tight">{formatValue(indicator.latest.value)} <span className="text-base font-normal text-[#5b6e6c]">{indicator.unit}</span></p>
        <p className={`mt-2 text-sm font-semibold ${change.tone === "up" ? "text-rose-700" : change.tone === "down" ? "text-blue-700" : "text-[#5b6e6c]"}`}>前回比 {change.text}</p>
      </div>
      {series && <div className="min-w-0 overflow-hidden rounded-xl bg-[#f7faf8] px-2"><TrendChart series={series} compact /></div>}
    </div>
    <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#e8eeea] pt-4"><div><dt className="label">対象期間</dt><dd className="mt-1 text-sm">{indicator.latest.period}</dd></div><div><dt className="label">更新日</dt><dd className="mt-1 text-sm">{formatDate(indicator.latest.publishedAt)}</dd></div></dl>
    <p className="mt-5 text-sm font-semibold text-[#176b5b]">詳細と一次情報を見る →</p>
  </Link>;
}
