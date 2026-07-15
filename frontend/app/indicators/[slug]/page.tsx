import Link from "next/link";
import { notFound } from "next/navigation";
import { DevelopmentNotice } from "@/components/DevelopmentNotice";
import { TrendChart } from "@/components/TrendChart";
import { getIndicator } from "@/lib/api";
import { changeLabel, formatDate, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function IndicatorDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let indicator;
  try { indicator = await getIndicator(slug); } catch { notFound(); }
  const change = changeLabel(indicator.change);
  return <main className="page py-10 md:py-16">
    <Link href="/" className="text-sm text-[#176b5b]">← ダッシュボード</Link>
    <div className="mt-8"><DevelopmentNotice /></div>
    <header className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div><p className="eyebrow">{indicator.category}</p><h1 className="mt-3 text-4xl font-bold">{indicator.name}</h1><p className="mt-5 text-5xl font-bold">{formatValue(indicator.latest.value)} <span className="text-xl font-normal text-[#5b6e6c]">{indicator.unit}</span></p></div>
      <div className="panel min-w-60 p-5"><p className="label">前回値</p><p className="mt-1 text-xl font-semibold">{indicator.previous ? `${formatValue(indicator.previous.value)} ${indicator.unit}` : "—"}</p><p className="mt-2 text-sm font-semibold">増減 {change.text} {indicator.unit}</p></div>
    </header>
    <section className="panel mt-10 p-5 md:p-8"><div className="mb-8 flex items-center justify-between"><div><p className="eyebrow">Fact</p><h2 className="mt-2 text-2xl font-bold">過去データ</h2></div><p className="text-sm text-[#5b6e6c]">単位：{indicator.unit}</p></div><TrendChart series={indicator.series ?? []} /></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-5">
      <section className="panel p-6 lg:col-span-3"><p className="eyebrow">Explanation</p><h2 className="mt-2 text-xl font-bold">この指標について</h2><p className="mt-5 leading-8 text-[#455b58]">{indicator.description}</p><p className="mt-5 text-xs text-[#6b7c79]">この説明は指標の一般的な読み方です。上記の数値そのものとは分けて掲載しています。</p></section>
      <section className="panel p-6 lg:col-span-2"><p className="eyebrow">Source</p><h2 className="mt-2 text-xl font-bold">出典・データ情報</h2><dl className="mt-5 space-y-4"><div><dt className="label">出典機関</dt><dd className="mt-1">{indicator.sourceName}</dd></div><div><dt className="label">対象期間</dt><dd className="mt-1">{indicator.latest.period}</dd></div><div><dt className="label">公開日</dt><dd className="mt-1">{formatDate(indicator.latest.publishedAt)}</dd></div><div><dt className="label">最終取得日時</dt><dd className="mt-1">{formatDate(indicator.latest.fetchedAt)}</dd></div></dl><a className="mt-6 inline-block font-semibold text-[#176b5b] underline" href={indicator.sourceUrl} target="_blank" rel="noreferrer">一次情報を確認する ↗</a></section>
    </div>
  </main>;
}

