import Link from "next/link";
import { getRelatedIndicators } from "@/lib/relatedIndicators";

type RelatedIndicatorsProps = {
  indicatorSlug: string;
  availableSlugs: readonly string[];
};

export function RelatedIndicators({ indicatorSlug, availableSlugs }: RelatedIndicatorsProps) {
  const relatedIndicators = getRelatedIndicators(indicatorSlug);
  if (relatedIndicators.length === 0) return null;

  const available = new Set(availableSlugs);

  return <section className="panel mt-6 p-6 md:p-8" aria-labelledby="related-indicators-heading">
    <p className="eyebrow">Related indicators</p>
    <h2 id="related-indicators-heading" className="mt-2 text-2xl font-bold">関連する指標</h2>
    <p className="mt-3 max-w-3xl leading-7 text-[#5b6e6c]">人口と関連する指標をあわせて見ると、日本の構造への理解が深まります。</p>
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      {relatedIndicators.map((related) => {
        const content = <>
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-lg font-bold">{related.name}</h3>
            {available.has(related.slug)
              ? <span className="shrink-0 text-sm font-semibold text-[#176b5b]">見る →</span>
              : <span className="shrink-0 rounded-full bg-[#edf1ed] px-3 py-1 text-xs font-semibold text-[#5b6e6c]">準備中</span>}
          </div>
          <p className="mt-3 text-sm leading-6 text-[#5b6e6c]">{related.description}</p>
        </>;

        return available.has(related.slug)
          ? <Link key={related.slug} href={`/indicators/${related.slug}`} className="block rounded-2xl border border-[#dce5df] p-5 no-underline transition hover:border-[#93b8ae] hover:bg-[#f8faf7]">{content}</Link>
          : <div key={related.slug} className="rounded-2xl border border-[#dce5df] bg-[#fafbf9] p-5">{content}</div>;
      })}
    </div>
  </section>;
}
