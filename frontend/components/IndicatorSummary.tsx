import type { IndicatorSummary as IndicatorSummaryData } from "@/lib/calculateIndicatorSummary";
import { formatValue } from "@/lib/format";

type IndicatorSummaryProps = {
  summary?: IndicatorSummaryData;
  unit: string;
};

function signedValue(value: string, suffix = ""): string {
  if (/^-/.test(value)) return `−${formatValue(value.replace(/^-/, ""))}${suffix}`;
  if (/^\+?0(?:\.0+)?$/.test(value)) return `±0${suffix}`;
  return `+${formatValue(value)}${suffix}`;
}

const directionLabel = {
  increase: "増加",
  decrease: "減少",
  unchanged: "変化なし",
} as const;

export function IndicatorSummary({ summary, unit }: IndicatorSummaryProps) {
  if (!summary) return null;

  return <section className="panel mt-10 p-5 md:p-8" aria-labelledby="indicator-summary-heading">
    <p className="eyebrow">Summary</p>
    <h2 id="indicator-summary-heading" className="mt-2 text-2xl font-bold">この指標の要点</h2>
    <p className="mt-3 text-sm leading-6 text-[#5b6e6c]">表示中の時系列データから機械的に算出した事実です。</p>
    <dl className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className="rounded-2xl border border-[#dce5df] p-5">
        <dt className="label">最新値</dt>
        <dd className="mt-2 text-xl font-bold">{formatValue(summary.latest.value)} <span className="text-sm font-normal text-[#5b6e6c]">{unit}</span></dd>
        <dd className="mt-2 break-words text-sm text-[#5b6e6c]">{summary.latest.period}</dd>
      </div>

      {summary.comparison && <>
        <div className="rounded-2xl border border-[#dce5df] p-5">
          <dt className="label">直前からの増減値</dt>
          <dd className="mt-2 text-xl font-bold">{directionLabel[summary.comparison.direction]} {signedValue(summary.comparison.change)} <span className="text-sm font-normal text-[#5b6e6c]">{unit}</span></dd>
          {summary.previous && <dd className="mt-2 break-words text-sm text-[#5b6e6c]">比較対象：{summary.previous.period}</dd>}
        </div>
        <div className="rounded-2xl border border-[#dce5df] p-5">
          <dt className="label">直前からの増減率</dt>
          <dd className="mt-2 text-xl font-bold">{summary.comparison.rateUnavailable
            ? "算出不可"
            : `${directionLabel[summary.comparison.rateDirection ?? summary.comparison.direction]} ${signedValue(summary.comparison.changeRate ?? "0", "%")}`}</dd>
          {summary.comparison.rateUnavailable && <dd className="mt-2 text-sm text-[#5b6e6c]">前回値が0のため算出していません。</dd>}
        </div>
      </>}

      <div className="rounded-2xl border border-[#dce5df] p-5">
        <dt className="label">期間内の最大値</dt>
        <dd className="mt-2 text-xl font-bold">{formatValue(summary.maximum.value)} <span className="text-sm font-normal text-[#5b6e6c]">{unit}</span></dd>
        <dd className="mt-2 break-words text-sm text-[#5b6e6c]">{summary.maximum.period}</dd>
      </div>
      <div className="rounded-2xl border border-[#dce5df] p-5">
        <dt className="label">期間内の最小値</dt>
        <dd className="mt-2 text-xl font-bold">{formatValue(summary.minimum.value)} <span className="text-sm font-normal text-[#5b6e6c]">{unit}</span></dd>
        <dd className="mt-2 break-words text-sm text-[#5b6e6c]">{summary.minimum.period}</dd>
      </div>
    </dl>
  </section>;
}
