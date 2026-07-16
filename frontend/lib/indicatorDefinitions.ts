export type IndicatorDefinition = {
  definition: string;
  interpretation?: string;
  cautions?: readonly string[];
  sourceLabel?: string;
  sourceUrl?: string;
};

const indicatorDefinitions = {
  population: {
    definition: "総務省統計局の人口推計は、国勢調査人口を基準人口とし、その後の人口動向を人口関連資料から得て、毎月1日現在の全国の総人口を算出したものです。KOKUSEIでは総人口の確定値を万人単位で表示しています。",
    interpretation: "前回より数値が増えた場合は、表示された対象期間の総人口が前回の対象期間より増えたことを示します。減った場合は、総人口が前回より減ったことを示します。この数値だけから増減の理由を判断することはできません。",
    cautions: [
      "人口推計の最新月は概算値として公表され、その後、算出用資料の更新を反映した確定値が5か月後に公表されます。KOKUSEIは確定値だけを表示しています。",
      "人口推計は国勢調査人口を基準に算出する統計です。国勢調査による人口と人口推計では、値を得る方法と値の性質が異なります。",
    ],
    sourceLabel: "総務省統計局「人口推計について」",
    sourceUrl: "https://www.stat.go.jp/data/jinsui/1.htm",
  },
  births: {
    definition: "出生数は、人口動態統計で集計される出生の件数です。人口動態調査は、戸籍法などに基づいて届け出られた出生、死亡、婚姻、離婚、死産の全数を対象とし、出生票には出生年月日や出生場所など出生届に基づく事項が記録されます。",
    interpretation: "前回より数値が増えた場合は、対象期間に集計された出生の件数が前回より増えたことを示します。減った場合は、集計された出生の件数が前回より減ったことを示します。増減の原因は出生数だけでは確認できません。",
    cautions: [
      "人口動態統計の速報、月報の概数、年報の確定数では、数値の確定度や集計客体が異なります。同じ区分の数値で比較する必要があります。",
      "出生数は件数を表す指標です。人口に対する割合を表す出生率とは区別して確認する必要があります。",
    ],
    sourceLabel: "厚生労働省「人口動態調査 調査の概要」",
    sourceUrl: "https://www.mhlw.go.jp/toukei/list/81-1b.html",
  },
  "unemployment-rate": {
    definition: "完全失業率は、就業者と完全失業者を合わせた労働力人口に占める完全失業者の割合です。完全失業者は、仕事に就いておらず、仕事があればすぐ就くことができ、仕事を探す活動をしていた人と定義されています。",
    interpretation: "数値が上がった場合は、労働力人口のうち完全失業者が占める割合が前回より上がったことを示します。下がった場合は、その割合が前回より下がったことを示します。",
    cautions: [
      "分母は総人口や15歳以上人口ではなく、就業者と完全失業者からなる労働力人口です。仕事を探す活動をしていない人は完全失業者に含まれません。",
      "月次値を前月と比較するときは、季節調整値か原数値かを確認する必要があります。季節調整は毎年繰り返される季節変動を除いて比較するために行われます。",
    ],
    sourceLabel: "総務省統計局「労働力調査に関するQ&A」",
    sourceUrl: "https://www.stat.go.jp/data/roudou/qa-1.html",
  },
} satisfies Record<string, IndicatorDefinition>;

export function getIndicatorDefinition(slug: string): IndicatorDefinition | undefined {
  return indicatorDefinitions[slug as keyof typeof indicatorDefinitions];
}
