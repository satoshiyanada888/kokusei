import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DevelopmentNotice } from "@/components/DevelopmentNotice";
import { IndicatorDefinition } from "@/components/IndicatorDefinition";
import { IndicatorHistory } from "@/components/IndicatorHistory";
import { IndicatorNavigation } from "@/components/IndicatorNavigation";
import { IndicatorSummary } from "@/components/IndicatorSummary";
import { RelatedIndicators } from "@/components/RelatedIndicators";
import { getIndicator, getIndicators, isNotFoundError } from "@/lib/api";
import { changeLabel, formatDate, formatValue } from "@/lib/format";
import { calculateIndicatorSummary } from "@/lib/calculateIndicatorSummary";
import { getAdjacentIndicators } from "@/lib/indicatorNavigation";
import { getIndicatorDefinition } from "@/lib/indicatorDefinitions";
import { getRelatedIndicators } from "@/lib/relatedIndicators";
import { createIndicatorMetadata, missingIndicatorMetadata } from "@/lib/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const indicator = await getIndicator(slug);
    return createIndicatorMetadata(indicator);
  } catch {
    return missingIndicatorMetadata;
  }
}

export default async function IndicatorDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let indicator;
  try {
    indicator = await getIndicator(slug);
  } catch (error) {
    if (isNotFoundError(error)) notFound();
    throw error;
  }
  const indicators = await getIndicators();
  const availableSlugs = getRelatedIndicators(slug).length > 0
    ? indicators.map(({ slug: availableSlug }) => availableSlug)
    : [];
  const { previous, next } = getAdjacentIndicators(indicators, slug);
  const summary = calculateIndicatorSummary(indicator.series ?? []);
  const definition = getIndicatorDefinition(slug);
  const change = changeLabel(indicator.change);
  return <main className="page py-10 md:py-16">
    <Link href="/" className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-[#176b5b] underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">← ダッシュボード</Link>
    {indicator.developmentData && <div className="mt-8"><DevelopmentNotice /></div>}
    <header className="mt-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div><div className="flex items-center gap-3"><p className="eyebrow">{indicator.category}</p>{!indicator.developmentData && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">公式・確定値</span>}</div><h1 className="mt-3 text-4xl font-bold">{indicator.name}</h1><p className="mt-5 text-5xl font-bold">{formatValue(indicator.latest.value)} <span className="text-xl font-normal text-[#5b6e6c]">{indicator.unit}</span></p></div>
      <div className="panel min-w-60 p-5"><p className="label">前回値</p><p className="mt-1 text-xl font-semibold">{indicator.previous ? `${formatValue(indicator.previous.value)} ${indicator.unit}` : "—"}</p><p className="mt-2 text-sm font-semibold">増減 {change.text} {indicator.unit}</p></div>
    </header>
    <IndicatorSummary summary={summary} unit={indicator.unit} />
    <IndicatorDefinition definition={definition} />
    <IndicatorHistory series={indicator.series ?? []} unit={indicator.unit} />
    <div className="mt-6 grid gap-6 lg:grid-cols-5">
      <section className="panel p-6 lg:col-span-3"><p className="eyebrow">Explanation</p><h2 className="mt-2 text-xl font-bold">この指標について</h2><p className="mt-5 leading-8 text-[#455b58]">{indicator.description}</p><p className="mt-5 text-xs text-[#5b6e6c]">この説明は指標の一般的な読み方です。上記の数値そのものとは分けて掲載しています。</p></section>
      <section className="panel p-6 lg:col-span-2"><p className="eyebrow">Source</p><h2 className="mt-2 text-xl font-bold">出典・データ情報</h2><dl className="mt-5 space-y-4"><div><dt className="label">出典機関</dt><dd className="mt-1">{indicator.sourceName}</dd></div><div><dt className="label">対象期間</dt><dd className="mt-1">{indicator.latest.period}</dd></div><div><dt className="label">公開日</dt><dd className="mt-1">{formatDate(indicator.latest.publishedAt)}</dd></div><div><dt className="label">最終取得日時</dt><dd className="mt-1">{formatDate(indicator.latest.fetchedAt)}</dd></div></dl><a className="mt-6 inline-block font-semibold text-[#176b5b] underline" href={indicator.sourceUrl} target="_blank" rel="noopener noreferrer">一次情報を確認する ↗</a></section>
    </div>
    <RelatedIndicators indicatorSlug={slug} availableSlugs={availableSlugs} />
    <IndicatorNavigation currentSlug={slug} previous={previous} next={next} />
  </main>;
}
