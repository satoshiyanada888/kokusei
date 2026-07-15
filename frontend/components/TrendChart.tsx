"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { IndicatorValue } from "@/lib/types";

export function TrendChart({ series, compact = false }: { series: IndicatorValue[]; compact?: boolean }) {
  const data = series.map((point) => ({ period: point.period.replace("（開発用）", ""), value: Number(point.value) }));
  if (compact) return <div aria-label="簡易トレンド" className="h-16 w-32">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><Line dataKey="value" stroke="#176b5b" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer>
  </div>;
  return <div aria-label="過去データの折れ線グラフ" className="h-80 w-full">
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 4 }}>
      <XAxis dataKey="period" tick={{ fontSize: 12 }} /><YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} width={55} />
      <Tooltip formatter={(value) => [Number(value).toLocaleString("ja-JP"), "値"]} />
      <Line type="monotone" dataKey="value" stroke="#176b5b" strokeWidth={3} dot={{ fill: "#176b5b", r: 4 }} />
    </LineChart></ResponsiveContainer>
  </div>;
}

