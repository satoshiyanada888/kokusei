import type { Metadata } from "next";
import { InformationPage } from "@/components/InformationPage";
import { createStaticPageMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/siteConfig";

const description = "KOKUSEIのデータ、表示上の問題、改善要望に関する現在の問い合わせ方法を案内します。";
export const metadata: Metadata = createStaticPageMetadata({ title: "お問い合わせ", description, path: "/contact" });

export default function ContactPage() {
  return <InformationPage eyebrow="Contact" title="お問い合わせ" introduction="現在、KOKUSEIへの連絡は公開GitHubリポジトリのIssuesで受け付けています。">
    <section className="panel p-6 md:p-8">
      <h2 className="text-2xl font-bold">GitHub Issues</h2>
      <p className="mt-4 leading-8 text-[#455b58]">データの誤りと思われる箇所、表示上の問題、改善要望は、内容を確認できる範囲でGitHub Issuesからお知らせください。公開の場へAPIキー、認証情報、個人情報などを書き込まないでください。</p>
      <a href={siteConfig.issuesUrl} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block max-w-full break-words font-semibold text-[#176b5b] underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">KOKUSEIのGitHub Issuesを開く <span aria-hidden="true">↗</span><span className="sr-only">（新しいタブで開きます）</span></a>
    </section>
    <section className="panel p-6 md:p-8"><h2 className="text-2xl font-bold">現在提供していない連絡方法</h2><p className="mt-4 leading-8 text-[#455b58]">問い合わせフォーム、公開メールアドレス、問い合わせ用SNSアカウントは、現在このサイトでは案内していません。</p></section>
  </InformationPage>;
}
