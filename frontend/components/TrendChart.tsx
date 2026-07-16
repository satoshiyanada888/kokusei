"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndicatorValue } from "@/lib/types";

export function compactDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum;
  const padding = range > 0 ? range * 0.18 : Math.max(Math.abs(maximum) * 0.05, 1);
  return [minimum - padding, maximum + padding];
}

export function TrendChart({ series, compact = false }: { series: IndicatorValue[]; compact?: boolean }) {
  const data = series.map((point) => ({ period: point.period.replace("（開発用）", ""), value: Number(point.value) }));
  if (compact) return <div role="img" aria-label="簡易トレンド" className="h-28 w-full min-w-0 overflow-hidden sm:h-20">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 4, bottom: 8, left: 4 }}>
      <YAxis hide domain={compactDomain(data.map((point) => point.value))} allowDataOverflow />
      <Line type="monotone" dataKey="value" stroke="#176b5b" strokeWidth={2.5} dot={false} isAnimationActive={false} />
    </LineChart></ResponsiveContainer>
  </div>;
  return <div role="img" aria-label="過去データの折れ線グラフ" className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
      <XAxis dataKey="period" tick={{ fontSize: 12 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} width={55} />
      <Tooltip formatter={(value) => [Number(value).toLocaleString("ja-JP"), "値"]} />
      <Line type="monotone" dataKey="value" stroke="#176b5b" strokeWidth={3} dot={{ fill: "#176b5b", r: 4 }} />
    </LineChart></ResponsiveContainer>
  </div>;
}
