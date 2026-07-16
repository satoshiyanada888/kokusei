import type { Metadata } from "next";
import {
  LegalPageLayout,
  legalHeadingClassName,
  legalLinkClassName,
  legalListClassName,
  legalParagraphClassName,
  legalSectionClassName,
} from "@/components/LegalPageLayout";
import { publicDataTerms } from "@/lib/legalDocuments";
import { createStaticPageMetadata } from "@/lib/metadata";

const description = "KOKUSEIが公的統計の出典、値の性質、更新、欠損、単位、丸め、グラフ、要点をどのように扱うか説明します。";
export const metadata: Metadata = createStaticPageMetadata({ title: "データ利用方針", description, path: "/data-policy" });

export default function DataPolicyPage() {
  return <LegalPageLayout eyebrow="Data Policy" title="データ利用方針" introduction="KOKUSEIが統計データを取得、保存、表示するときの基本方針を説明します。">
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>一次情報と出典</h2><p className={legalParagraphClassName}>公式データとして扱うのは、公的機関が公開する一次情報から取得し、値、対象期間、公開日、出典URLを検証できるデータです。指標ごとに提供機関と一次情報へのリンクを表示します。開発用データは公式データと区別して表示します。</p><p className={legalParagraphClassName}>KOKUSEIは各公的機関から公認または承認を受けたサービスではありません。統計データの利用条件と権利は、各提供機関や第三者が定める条件に従います。</p></section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>値の性質と更新</h2>
      <ul className={legalListClassName}>
        <li>確定値、速報値、推計値、開発用データを、取得できるメタデータの範囲で区別します。現在の人口取得処理は、e-Statの人口推計にある確定値を対象とします。</li>
        <li>外部データとはリアルタイム同期しません。取得処理を実行し、検証と保存が完了した時点で反映します。</li>
        <li>同じ対象期間・同じ値は重複登録せず、同じ期間の値が変わった場合は更新履歴へ記録します。取得に失敗した場合、既存値を削除・上書きしません。</li>
        <li>提供元の遡及改訂や訂正から反映まで時間差が生じることがあります。最新性より、出典と検証可能性を優先する場合があります。</li>
      </ul>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>欠損値・数値・単位</h2>
      <ul className={legalListClassName}>
        <li>欠損または無効な値を推測で補間しません。表示できる有効なデータがない場合は、空の状態として案内します。</li>
        <li>統計値はデータベースでnumeric型、APIで10進文字列として扱います。画面表示では指標の単位に合わせて桁区切りと丸めを行うことがあります。</li>
        <li>グラフ描画時は可視化ライブラリへ数値として渡すため、保存値より精度が低く見える可能性があります。厳密な値の確認では一次情報を優先してください。</li>
        <li>単位変換を行う場合は内容を記録します。人口は取得した「人」の整数値を「万人」の10進値へ変換して保存・表示します。</li>
      </ul>
    </section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>グラフと「この指標の要点」</h2><p className={legalParagraphClassName}>グラフは保存済みの有効な時系列データを対象期間順に表示します。「この指標の要点」は、最新値、直前値との差と増減率、期間内の最大値・最小値を既存データから機械的に算出します。前回値が0の場合は増減率を算出せず、データ不足や無効な値は計算対象から除外します。画面では読みやすさのため小数点以下を丸める場合があります。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>定義・注意点・関連指標</h2><p className={legalParagraphClassName}>指標の定義、数字の読み方、比較上の注意点は、確認できた公式資料に基づく型付き設定として表示します。説明が確認できない指標には推測した文章を表示しません。関連指標は、あわせて確認するための探索補助であり、統計間の因果関係や評価を示しません。</p></section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>公的統計の利用条件</h2>
      <p className={legalParagraphClassName}>確認した利用条件では、出典の表示、編集・加工した場合の明示、第三者の権利や個別条件の確認が求められています。数値データと、文章・図版・ロゴなどでは権利や条件が異なる場合があります。再利用時は対象データの最新の利用条件を確認してください。</p>
      <ul className={legalListClassName}>{publicDataTerms.map((term) => <li key={term.url}><a href={term.url} target="_blank" rel="noopener noreferrer" className={legalLinkClassName}>{term.label} <span aria-hidden="true">↗</span><span className="sr-only">（新しいタブで開きます）</span></a></li>)}</ul>
    </section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>相違・誤りの連絡</h2><p className={legalParagraphClassName}>KOKUSEIと提供機関の一次情報に相違がある場合は、一次情報を優先してください。誤りと思われる箇所は、<a href="/contact" className={legalLinkClassName}>お問い合わせページ</a>の方法でお知らせください。</p></section>
  </LegalPageLayout>;
}
