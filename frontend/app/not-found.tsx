import type { Metadata } from "next";
import { NotFoundState } from "@/components/NotFoundState";
import { siteConfig } from "@/lib/siteConfig";

export const metadata: Metadata = {
  title: { absolute: `ページが見つかりません | ${siteConfig.name}` },
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return <NotFoundState />;
}
