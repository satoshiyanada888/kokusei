import Link from "next/link";
import { footerNavigation } from "@/lib/siteNavigation";
import { siteConfig } from "@/lib/siteConfig";

export function SiteFooter({ year = new Date().getFullYear() }: { year?: number }) {
  return <footer className="mt-20 border-t border-[#dce5df] bg-white py-10 text-[#455b58]">
    <div className="page grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-12">
      <div className="max-w-xl">
        <p className="text-lg font-bold tracking-[.12em] text-[#102a2a]">{siteConfig.name}</p>
        <p className="mt-4 break-words text-sm leading-7">{siteConfig.footerDescription}</p>
      </div>
      <nav aria-label="サイト情報" className="grid gap-1 text-sm sm:grid-cols-2">
        {footerNavigation.map((item) => <Link
          key={item.href}
          href={item.href}
          className="min-h-11 rounded-lg px-3 py-3 font-semibold underline decoration-[#9eb8b1] underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#176b5b]"
        >{item.label}</Link>)}
      </nav>
    </div>
    <p className="page mt-8 border-t border-[#e7ece9] pt-6 text-sm text-[#5b6e6c]">© {year} {siteConfig.name}</p>
  </footer>;
}
