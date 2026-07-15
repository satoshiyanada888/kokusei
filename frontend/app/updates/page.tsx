import Link from "next/link";
import { DevelopmentNotice } from "@/components/DevelopmentNotice";
import { getUpdates } from "@/lib/api";
import { formatDate, formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const updates = await getUpdates();
  return <main className="page py-12 md:py-16"><p className="eyebrow">Change log</p><h1 className="mt-3 text-4xl font-bold">更新履歴</h1><p className="mt-4 text-[#5b6e6c]">取得データの変化を、新しいものから表示します。</p>{updates.some((update) => update.developmentData) && <div className="mt-8"><DevelopmentNotice partial={updates.some((update) => !update.developmentData)} /></div>}
    <section className="panel mt-8 overflow-hidden">
      {updates.length === 0 ? <p className="p-8 text-[#5b6e6c]">更新履歴はまだありません。</p> : <ol>{updates.map((update) => <li key={update.id} className="grid gap-5 border-b border-[#e3eae6] p-6 last:border-0 md:grid-cols-[150px_1fr_auto] md:items-center"><div><p className="text-sm font-semibold">{formatDate(update.detectedAt)}</p><p className="label mt-1">{update.period}</p></div><div><Link href={`/indicators/${update.indicatorSlug}`} className="font-bold">{update.indicatorName}</Link><p className="mt-2 text-sm"><span className="text-[#6b7c79]">{update.previousValue ? formatValue(update.previousValue) : "—"}</span> <span className="mx-2">→</span> <strong>{formatValue(update.currentValue)} {update.unit}</strong></p></div><a href={update.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[#176b5b] underline">{update.sourceName} ↗</a></li>)}</ol>}
    </section>
  </main>;
}
