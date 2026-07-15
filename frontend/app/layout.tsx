import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = { title: "KOKUSEI | 日本を、データで知る。", description: "公的機関の一次情報を確認できる日本の統計ダッシュボード" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body>
    <header className="border-b border-[#dce5df] bg-white/90">
      <div className="page flex h-16 items-center justify-between">
        <Link href="/" className="text-lg font-bold tracking-[.12em] no-underline">KOKUSEI</Link>
        <nav className="flex gap-6 text-sm"><Link href="/">ダッシュボード</Link><Link href="/updates">更新履歴</Link></nav>
      </div>
    </header>
    {children}
    <footer className="mt-20 border-t border-[#dce5df] py-10 text-center text-sm text-[#5b6e6c]">KOKUSEI — 一次情報から、日本の現在地を確認する。</footer>
  </body></html>;
}

