import { DevelopmentNotice } from "@/components/DevelopmentNotice";
import { IndicatorCard } from "@/components/IndicatorCard";
import { getIndicator, getIndicators } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const summaries = await getIndicators();
  const indicators = await Promise.all(summaries.map((item) => getIndicator(item.slug)));
  return <main className="page py-12 md:py-20">
    <section className="max-w-3xl"><p className="eyebrow">Japan, in primary data</p><h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">日本を、データで知る。</h1><p className="mt-6 text-lg leading-8 text-[#5b6e6c]">公的機関の一次情報をもとに、日本の現在地を分かりやすく表示します。</p></section>
    <div className="mt-10"><DevelopmentNotice /></div>
    <section className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3" aria-label="主要指標">
      {indicators.map((indicator) => <IndicatorCard key={indicator.slug} indicator={indicator} />)}
    </section>
  </main>;
}
