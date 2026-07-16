import Link from "next/link";
import { SiteLogo } from "./SiteLogo";

export function SiteHeader() {
  return <header className="border-b border-[#dce5df] bg-white/90">
    <div className="page flex h-16 items-center justify-between">
      <SiteLogo />
      <nav aria-label="主要ナビゲーション" className="flex gap-4 text-sm sm:gap-6">
        <Link href="/" className="flex min-h-11 items-center rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#176b5b]">ダッシュボード</Link>
        <Link href="/updates" className="flex min-h-11 items-center rounded-md focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#176b5b]">更新履歴</Link>
      </nav>
    </div>
  </header>;
}
