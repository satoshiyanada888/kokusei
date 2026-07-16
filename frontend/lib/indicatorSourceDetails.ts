export type IndicatorSourceDetail = {
  statisticName: string;
  updateNote?: string;
};

const indicatorSourceDetails: Readonly<Record<string, IndicatorSourceDetail>> = {
  population: {
    statisticName: "人口推計",
    updateNote: "原則月次で公表されます。KOKUSEIでは確定値のみを公式データとして表示します。",
  },
  births: { statisticName: "人口動態統計" },
  "nominal-gdp": { statisticName: "国民経済計算（GDP統計）" },
  cpi: { statisticName: "消費者物価指数（CPI）" },
  "unemployment-rate": { statisticName: "労働力調査" },
};

export const getIndicatorSourceDetail = (slug: string): IndicatorSourceDetail | undefined =>
  indicatorSourceDetails[slug];
