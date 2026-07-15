import Link from "next/link";
import { Indicator } from "@/lib/types";
import { changeLabel, formatDate, formatValue } from "@/lib/format";
import { TrendChart } from "./TrendChart";

export function IndicatorCard({ indicator }: { indicator: Indicator }) {
  const change = changeLabel(indicator.change);
  const series = indicator.series?.length ? indicator.series : [indicator.previous, indicator.latest].filter(Boolean) as Indicator["series"];
  return <Link href={`/indicators/${indicator.slug}`} className="panel group block p-6 no-underline transition hover:-translate-y-0.5 hover:border-[#93b8ae]">
    <div className="flex items-start justify-between"><div><p className="eyebrow">{indicator.category}</p><h2 className="mt-2 text-xl font-bold">{indicator.name}</h2></div>{series && <TrendChart series={series} compact />}</div>
    <p className="mt-6 text-3xl font-bold tracking-tight">{formatValue(indicator.latest.value)} <span className="text-base font-normal text-[#5b6e6c]">{indicator.unit}</span></p>
    <p className={`mt-2 text-sm font-semibold ${change.tone === "up" ? "text-rose-700" : change.tone === "down" ? "text-blue-700" : "text-[#5b6e6c]"}`}>前回比 {change.text}</p>
    <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-[#e8eeea] pt-4"><div><dt className="label">対象期間</dt><dd className="mt-1 text-sm">{indicator.latest.period}</dd></div><div><dt className="label">更新日</dt><dd className="mt-1 text-sm">{formatDate(indicator.latest.publishedAt)}</dd></div></dl>
    <p className="mt-5 text-sm font-semibold text-[#176b5b]">詳細と一次情報を見る →</p>
  </Link>;
}

