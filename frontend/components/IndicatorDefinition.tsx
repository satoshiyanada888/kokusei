import type { IndicatorDefinition as IndicatorDefinitionData } from "@/lib/indicatorDefinitions";

type IndicatorDefinitionProps = {
  definition?: IndicatorDefinitionData;
};

export function IndicatorDefinition({ definition }: IndicatorDefinitionProps) {
  if (!definition) return null;

  return <section className="panel mt-10 p-5 md:p-8" aria-labelledby="indicator-definition-heading">
    <p className="eyebrow">Definition</p>
    <h2 id="indicator-definition-heading" className="mt-2 text-2xl font-bold">この指標とは</h2>
    <dl className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="min-w-0">
        <dt className="text-lg font-bold">定義</dt>
        <dd className="mt-3 break-words leading-7 text-[#455b58]">{definition.definition}</dd>
      </div>
      {definition.interpretation && <div className="min-w-0">
        <dt className="text-lg font-bold">数字の読み方</dt>
        <dd className="mt-3 break-words leading-7 text-[#455b58]">{definition.interpretation}</dd>
      </div>}
      {definition.cautions && definition.cautions.length > 0 && <div className="min-w-0">
        <dt className="text-lg font-bold">比較するときの注意点</dt>
        <dd className="mt-3">
          <ul className="list-disc space-y-3 pl-5 leading-7 text-[#455b58]">
            {definition.cautions.map((caution) => <li key={caution} className="break-words">{caution}</li>)}
          </ul>
        </dd>
      </div>}
    </dl>
    {definition.sourceLabel && definition.sourceUrl && <a
      className="mt-7 inline-block max-w-full break-words font-semibold text-[#176b5b] underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]"
      href={definition.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
    >定義の根拠：{definition.sourceLabel} ↗</a>}
  </section>;
}
