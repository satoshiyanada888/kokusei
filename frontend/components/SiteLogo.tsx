import Link from "next/link";
import { siteConfig } from "@/lib/siteConfig";

export function BrandSymbol({ className = "h-8 w-8" }: { className?: string }) {
  return <svg
    aria-hidden="true"
    className={`shrink-0 ${className}`}
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="64" height="64" rx="16" fill="#176b5b" />
    <path d="M20 14v36M23 33l21-19M30 27l17 23" fill="none" stroke="#fff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function SiteLogo() {
  return <Link
    href="/"
    aria-label={`${siteConfig.name} トップページ`}
    className="flex min-h-11 shrink-0 items-center gap-2 rounded-md no-underline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]"
  >
    <BrandSymbol />
    <span className="whitespace-nowrap text-lg font-bold tracking-[.12em]">{siteConfig.name}</span>
  </Link>;
}
