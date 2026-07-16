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
import { siteConfig } from "@/lib/siteConfig";

const description = "KOKUSEIにおける利用者情報、Cookie、アクセスログ、外部サービス、問い合わせ情報の現在の取り扱いを説明します。";
export const metadata: Metadata = createStaticPageMetadata({ title: "プライバシーポリシー", description, path: "/privacy" });

export default function PrivacyPage() {
  return <LegalPageLayout eyebrow="Privacy" title="プライバシーポリシー" introduction="KOKUSEIの現在の実装における、利用者に関する情報の取り扱いを説明します。">
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>KOKUSEIが取得・保存する情報</h2>
      <p className={legalParagraphClassName}>KOKUSEIには、現在、利用者登録、ログイン、問い合わせフォーム、メールアドレスの登録機能はありません。アプリケーションのデータベースには、公開統計の指標、値、更新履歴を保存しており、利用者のプロフィールや問い合わせ内容を保存するテーブルはありません。</p>
      <p className={legalParagraphClassName}>利用者がページを閲覧すると、通信のためにIPアドレスやUser-Agentなどがサーバーへ送信されます。KOKUSEIのアプリケーションコードは、これらをデータベースへ保存する処理を実装していません。</p>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>Cookie・類似技術</h2>
      <p className={legalParagraphClassName}>現在、KOKUSEIは、利用者の識別、広告、アクセス解析を目的とするCookieを設定していません。localStorageやsessionStorageを用いた利用者追跡も実装していません。これらを将来導入する場合は、導入内容に合わせて本ページを更新します。</p>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>アクセスログとアクセス解析</h2>
      <p className={legalParagraphClassName}>現在、Google Analytics、Plausible、Cloudflare Web Analyticsなどのアクセス解析サービスおよび外部エラー監視サービスは導入していません。</p>
      <p className={legalParagraphClassName}>本番環境で使用するホスティング事業者、CDN、リバースプロキシなどが、運用・安全管理のため標準的なアクセス情報を記録する可能性があります。本番事業者、記録項目、保存期間はこのリポジトリからは確定できないため、運用環境を確定した際に確認し、本ページを更新します。</p>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>外部サービスと問い合わせ</h2>
      <p className={legalParagraphClassName}>KOKUSEIは、一次情報を確認するための公的機関サイトと、問い合わせ先であるGitHub Issuesへの通常の外部リンクを掲載しています。外部コンテンツの埋め込みは行っていません。リンク先では、各サービスの規約やプライバシーポリシーに基づいて情報が取り扱われます。</p>
      <p className={legalParagraphClassName}>問い合わせは公開GitHub Issuesで受け付けています。利用者が投稿したアカウント名、本文その他の情報は公開され、GitHubによって処理されます。個人情報、APIキー、認証情報、その他の機密情報を書き込まないでください。</p>
      <a href={siteConfig.issuesUrl} target="_blank" rel="noopener noreferrer" className={`${legalLinkClassName} mt-5 inline-block`}>KOKUSEIのGitHub Issuesを開く <span aria-hidden="true">↗</span><span className="sr-only">（新しいタブで開きます）</span></a>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>情報の利用目的・第三者提供・管理</h2>
      <ul className={legalListClassName}>
        <li>公開GitHub Issuesへ提供された情報は、問い合わせへの回答、問題の調査、サービス改善の検討に利用します。</li>
        <li>KOKUSEIが利用者情報を販売する機能や、広告配信のために第三者へ提供する処理は、現在実装していません。</li>
        <li>GitHubや将来確定する運用基盤での取り扱いは、それぞれの提供者が定める条件に従います。</li>
      </ul>
    </section>
    <section className={legalSectionClassName}>
      <h2 className={legalHeadingClassName}>変更と問い合わせ</h2>
      <p className={legalParagraphClassName}>機能や運用環境の変更により情報の取り扱いが変わる場合、本ページを更新します。現在の問い合わせ方法は、<a href="/contact" className={legalLinkClassName}>お問い合わせページ</a>で確認できます。</p>
    </section>
  </LegalPageLayout>;
}
