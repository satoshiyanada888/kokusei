import type { Metadata } from "next";
import { InformationPage } from "@/components/InformationPage";
import { createStaticPageMetadata } from "@/lib/metadata";

const description = "KOKUSEIの目的、提供内容、データと事実の扱い、運営上の方針を説明します。";
export const metadata: Metadata = createStaticPageMetadata({ title: "このサイトについて", description, path: "/about" });

export default function AboutPage() {
  return <InformationPage eyebrow="About" title="このサイトについて" introduction="KOKUSEIは、公的機関の一次情報を確認しながら、日本の構造を理解するための判断材料を提供するサービスです。">
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">目的</h2><p className="mt-4 leading-8 text-[#455b58]">人口、出生数、経済、物価、雇用の指標を、グラフと数値で短時間に確認できる状態を目指しています。利用者へ結論を与えるのではなく、一次情報を確認して自分で考えるための材料を提供します。</p></section>
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">提供している内容</h2><p className="mt-4 leading-8 text-[#455b58]">現在は、総人口、出生数、名目GDP、消費者物価指数、完全失業率を掲載しています。最新値、時系列グラフ、対象期間、更新日、統計の説明と一次情報へのリンクを確認できます。</p></section>
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">データの基本方針</h2><p className="mt-4 leading-8 text-[#455b58]">公式データとして扱うのは、公的機関が公開する一次情報を確認できる数値に限ります。出典、対象期間、公開日、取得日時を表示し、開発用データと公式データを区別します。掲載内容の利用時は、各指標からリンクしている一次情報も確認してください。</p></section>
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">事実と解釈</h2><p className="mt-4 leading-8 text-[#455b58]">時系列データから直接計算できる増減、増減率、最大値、最小値は事実として表示します。データから直接確認できない原因、因果関係、評価、将来予測は断定しません。</p></section>
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">運営上の方針</h2><p className="mt-4 leading-8 text-[#455b58]">一次情報への到達しやすさ、事実と説明の分離、出典の明示を重視します。掲載データの完全性や最新性を無条件に保証せず、確認できない内容を推測で補いません。</p></section>
  </InformationPage>;
}
