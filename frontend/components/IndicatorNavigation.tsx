import Link from "next/link";
import type { IndicatorNavigationItem } from "@/lib/indicatorNavigation";

type IndicatorNavigationProps = {
  currentSlug: string;
  previous?: IndicatorNavigationItem;
  next?: IndicatorNavigationItem;
};

const validSlug = /^[a-z0-9-]+$/;
const linkClassName = "block min-w-0 rounded-2xl border border-[#dce5df] bg-white px-5 py-4 no-underline transition hover:border-[#93b8ae] hover:bg-[#f8faf7] focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]";

function isValidTarget(item: IndicatorNavigationItem | undefined, currentSlug: string): item is IndicatorNavigationItem {
  return Boolean(item && item.slug !== currentSlug && validSlug.test(item.slug) && item.name.trim());
}

export function IndicatorNavigation({ currentSlug, previous, next }: IndicatorNavigationProps) {
  const previousIndicator = isValidTarget(previous, currentSlug) ? previous : undefined;
  const nextIndicator = isValidTarget(next, currentSlug) ? next : undefined;

  return <nav className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="指標間ナビゲーション">
    <div className={previousIndicator ? "min-w-0" : "hidden md:block"}>
      {previousIndicator && <Link href={`/indicators/${previousIndicator.slug}`} className={linkClassName} aria-label={`← 前の指標 ${previousIndicator.name}`}>
        <span className="label">← 前の指標</span>
        <span className="mt-1 block break-words font-bold">{previousIndicator.name}</span>
      </Link>}
    </div>

    <Link href="/" className={`${linkClassName} text-center`} aria-label="指標一覧へ戻る">
      <span className="font-bold">指標一覧へ戻る</span>
    </Link>

    <div className={nextIndicator ? "min-w-0 md:text-right" : "hidden md:block"}>
      {nextIndicator && <Link href={`/indicators/${nextIndicator.slug}`} className={linkClassName} aria-label={`次の指標 → ${nextIndicator.name}`}>
        <span className="label">次の指標 →</span>
        <span className="mt-1 block break-words font-bold">{nextIndicator.name}</span>
      </Link>}
    </div>
  </nav>;
}
