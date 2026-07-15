export type IndicatorValue = {
  value: string;
  period: string;
  publishedAt: string;
  fetchedAt: string;
};

export type Indicator = {
  slug: string;
  name: string;
  description: string;
  unit: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  latest: IndicatorValue;
  previous?: IndicatorValue;
  change?: string;
  series?: IndicatorValue[];
  developmentData: boolean;
};

export type UpdateHistory = {
  id: number;
  indicatorSlug: string;
  indicatorName: string;
  unit: string;
  previousValue?: string;
  currentValue: string;
  period: string;
  detectedAt: string;
  sourceName: string;
  sourceUrl: string;
};

