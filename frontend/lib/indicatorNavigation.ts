export type IndicatorNavigationItem = {
  slug: string;
  name: string;
};

export type AdjacentIndicators = {
  previous?: IndicatorNavigationItem;
  next?: IndicatorNavigationItem;
};

export function getAdjacentIndicators(
  indicators: readonly IndicatorNavigationItem[],
  currentSlug: string,
): AdjacentIndicators {
  const currentIndex = indicators.findIndex(({ slug }) => slug === currentSlug);
  if (currentIndex < 0) return {};

  const previous = indicators[currentIndex - 1];
  const next = indicators[currentIndex + 1];

  return {
    previous: previous?.slug !== currentSlug ? previous : undefined,
    next: next?.slug !== currentSlug ? next : undefined,
  };
}
