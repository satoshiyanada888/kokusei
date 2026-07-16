export type RelatedIndicator = {
  slug: string;
  name: string;
  description: string;
};

const relatedIndicatorsBySlug: Record<string, readonly RelatedIndicator[]> = {
  population: [
    {
      slug: "births",
      name: "出生数",
      description: "人口の増減と関連する指標です。総人口とあわせて見ると、人口構造の変化への理解が深まります。",
    },
    {
      slug: "working-age-population",
      name: "生産年齢人口",
      description: "人口構成と働き手の規模を捉える指標です。総人口とあわせて見ると、年齢構成への理解が深まります。",
    },
    {
      slug: "aging-rate",
      name: "高齢化率",
      description: "総人口に占める高齢者の割合を捉える指標です。総人口とあわせて見ると、年齢構成への理解が深まります。",
    },
    {
      slug: "unemployment-rate",
      name: "完全失業率",
      description: "雇用の状態と関連する指標です。人口とあわせて見ると、社会と経済の構造への理解が深まります。",
    },
  ],
};

export function getRelatedIndicators(slug: string): readonly RelatedIndicator[] {
  return relatedIndicatorsBySlug[slug] ?? [];
}
