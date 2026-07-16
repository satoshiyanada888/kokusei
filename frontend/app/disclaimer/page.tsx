import type { Metadata } from "next";
import {
  LegalPageLayout,
  legalHeadingClassName,
  legalLinkClassName,
  legalListClassName,
  legalParagraphClassName,
  legalSectionClassName,
} from "@/components/LegalPageLayout";
import { createStaticPageMetadata } from "@/lib/metadata";

const description = "KOKUSEIに掲載する統計、計算結果、関連指標、外部リンクとサービス利用上の注意事項を説明します。";
export const metadata: Metadata = createStaticPageMetadata({ title: "免責事項", description, path: "/disclaimer" });

export default function DisclaimerPage() {
  return <LegalPageLayout eyebrow="Disclaimer" title="免責事項" introduction="掲載情報とサービスを利用する前に確認していただきたい事項です。">
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>掲載情報</h2><p className={legalParagraphClassName}>KOKUSEIは公的機関の一次情報を確認し、出典と対象期間を示すよう努めますが、表示内容の正確性、完全性、最新性を完全には保証しません。取得、単位変換、丸め、計算、転記、表示などに誤りが含まれる可能性があります。KOKUSEIの表示と一次情報が異なる場合は、提供機関の一次情報を優先してください。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>統計の更新・訂正</h2><p className={legalParagraphClassName}>統計値は提供機関により速報値から確定値へ更新され、遡及改訂や訂正が行われることがあります。KOKUSEIへの反映には時間差が生じる場合があります。対象期間、公開日、取得日時、値の性質を確認してください。</p></section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>表示内容の読み方</h2>
      <ul className={legalListClassName}>
        <li>「この指標の要点」は、保存済みの時系列データから機械的に算出した事実の整理であり、原因、評価、将来予測を示しません。</li>
        <li>「関連する指標」は比較・探索の補助です。指標同士の因果関係を示すものではありません。</li>
        <li>開発用データは公式データではありません。画面上の表示を確認してください。</li>
      </ul>
    </section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>専門的助言ではないこと</h2><p className={legalParagraphClassName}>KOKUSEIの情報は、医療、法律、税務、投資、政策その他の専門的助言ではありません。重要な判断では一次情報と個別事情を確認し、必要に応じて適切な専門家へ相談してください。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>外部リンクとサービス提供</h2><p className={legalParagraphClassName}>外部リンク先の内容、正確性、可用性、情報の取り扱いは各運営者が管理します。また、保守、障害、通信環境、提供元の変更などにより、KOKUSEIを中断、停止、変更する場合があります。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>責任の範囲</h2><p className={legalParagraphClassName}>利用者は、一次情報を確認したうえで、自らの判断と責任でKOKUSEIを利用してください。利用に関連して損害が生じた場合の責任の有無と範囲は、具体的な事情および適用される法令に従って判断されます。この記載は、法令上制限または免除できない責任を排除するものではありません。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>誤りの連絡</h2><p className={legalParagraphClassName}>誤りと思われる箇所は、<a href="/contact" className={legalLinkClassName}>お問い合わせページ</a>の方法でお知らせください。公開GitHub Issuesへ個人情報や機密情報を書き込まないでください。</p></section>
  </LegalPageLayout>;
}
