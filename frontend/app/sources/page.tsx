import type { Metadata } from "next";
import { DataSourceList } from "@/components/DataSourceList";
import { EmptyState } from "@/components/EmptyState";
import { InformationPage } from "@/components/InformationPage";
import { getIndicators } from "@/lib/api";
import { createStaticPageMetadata } from "@/lib/metadata";

const description = "KOKUSEIに掲載している各指標の提供機関、統計名、値の性質、一次情報を確認できます。";
export const metadata: Metadata = createStaticPageMetadata({ title: "データ出典", description, path: "/sources" });
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const indicators = await getIndicators();
  return <InformationPage eyebrow="Sources" title="データ出典" introduction="掲載中の指標について、データ提供機関と一次情報を整理しています。開発用データは、公式データとは区別して表示します。">
    {indicators.length === 0
      ? <EmptyState description="現在、表示できる指標の出典情報がありません。" />
      : <DataSourceList indicators={indicators} />}
  </InformationPage>;
}
