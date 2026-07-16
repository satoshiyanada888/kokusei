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

const description = "KOKUSEIのサービス内容、利用条件、禁止事項、公的統計や第三者コンテンツの権利、免責などを定めます。";
export const metadata: Metadata = createStaticPageMetadata({ title: "利用規約", description, path: "/terms" });

export default function TermsPage() {
  return <LegalPageLayout eyebrow="Terms" title="利用規約" introduction="KOKUSEIを利用する際の条件を定めます。利用にあたっては、本規約をご確認ください。">
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>規約への同意とサービス内容</h2><p className={legalParagraphClassName}>KOKUSEIを利用することで、本規約に同意したものとして取り扱います。本サービスは、公的機関の一次情報をもとに、日本の人口・経済・雇用などの統計をグラフ、数値、説明および一次情報へのリンクとともに表示します。利用者へ結論を与えるものではなく、自ら確認し判断するための材料を提供します。</p></section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>利用条件と禁止事項</h2>
      <p className={legalParagraphClassName}>利用者は法令、本規約、およびデータ提供元の条件に従って利用してください。次の行為を禁止します。</p>
      <ul className={legalListClassName}>
        <li>法令または公序良俗に反する行為</li><li>不正アクセス、その試行、脆弱性の悪用その他サービスの安全性を損なう行為</li><li>自動化された大量の要求など、サービスへ過度な負荷を与え、運営を妨害する行為</li><li>出典、加工の有無、値の性質を偽り、KOKUSEIや公的機関が作成・公認した情報であると誤認させる行為</li><li>第三者の著作権、商標権、プライバシーその他の権利を侵害する行為</li>
      </ul>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>知的財産権とデータの権利</h2>
      <ul className={legalListClassName}>
        <li>KOKUSEI独自の文章、デザイン、名称その他のコンテンツに関する権利は、各権利者に帰属します。</li>
        <li>公的統計、外部サイトの文章・画像・ロゴ・商標などの権利は、各提供機関または第三者に帰属します。KOKUSEIは公的統計そのものの権利を保有しません。</li>
        <li>公的統計を再利用するときは、提供元の利用条件を確認し、出典と加工内容を適切に示してください。</li>
        <li>KOKUSEIが利用するオープンソースソフトウェアには、それぞれのライセンスが適用されます。</li>
        <li>公開リポジトリには、現在、KOKUSEIのコード全体に適用するLICENSEファイルがありません。コードが閲覧可能であることだけを、再利用の許諾とは扱わないでください。</li>
      </ul>
    </section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>変更・停止</h2><p className={legalParagraphClassName}>保守、障害、安全上の必要、提供元の変更その他の事情により、事前の予告なくサービスの内容を変更し、または提供を一時中断・終了することがあります。可能な範囲で、重要な変更はサイトまたは公開リポジトリで案内します。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>保証と責任の範囲</h2><p className={legalParagraphClassName}>掲載情報の正確性、完全性、最新性、特定目的への適合性、継続的な提供を完全には保証しません。利用者は一次情報を確認し、自らの判断と責任で利用してください。サービス利用に関する責任の有無と範囲は、適用される法令に従って判断されます。本規約は、法令上制限または免除できない責任を排除するものではありません。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>外部リンク</h2><p className={legalParagraphClassName}>外部リンク先は各運営者が管理しており、KOKUSEIはリンク先の内容、可用性、情報の取り扱いを管理していません。リンク先の規約・方針を確認してください。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>規約の変更</h2><p className={legalParagraphClassName}>サービス内容や運用条件の変更に応じ、必要な範囲で本規約を変更します。変更した場合は最終更新日を更新し、本ページに掲載します。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>準拠法・管轄</h2><p className={legalParagraphClassName}>本規約では、準拠法および第一審の専属的合意管轄裁判所を個別に指定していません。紛争が生じた場合は、適用される法令および手続に従います。</p></section>
    <section className={legalSectionClassName}><h2 className={legalHeadingClassName}>問い合わせ</h2><p className={legalParagraphClassName}>本規約に関する連絡方法は、<a href="/contact" className={legalLinkClassName}>お問い合わせページ</a>をご確認ください。GitHub Issuesは公開されるため、個人情報や機密情報を書き込まないでください。</p></section>
  </LegalPageLayout>;
}
