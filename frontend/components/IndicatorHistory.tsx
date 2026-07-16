import { EmptyState } from "./EmptyState";
import { TrendChart } from "./TrendChart";
import type { IndicatorValue } from "@/lib/types";

type IndicatorHistoryProps = {
  series: IndicatorValue[];
  unit: string;
};

export function IndicatorHistory({ series, unit }: IndicatorHistoryProps) {
  if (series.length === 0) return <div className="mt-10">
    <EmptyState
      title="表示できる時系列データがありません"
      description="この指標には、現在表示できる過去データが登録されていません。"
    />
  </div>;

  return <section className="panel mt-10 p-5 md:p-8">
    <div className="mb-8 flex items-center justify-between gap-4">
      <div><p className="eyebrow">Fact</p><h2 className="mt-2 text-2xl font-bold">過去データ</h2></div>
      <p className="shrink-0 text-sm text-[#5b6e6c]">単位：{unit}</p>
    </div>
    <TrendChart series={series} />
  </section>;
}
