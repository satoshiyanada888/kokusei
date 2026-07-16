type EmptyStateProps = {
  title?: string;
  description?: string;
};

export function EmptyState({
  title = "表示できるデータがありません",
  description,
}: EmptyStateProps) {
  return <section
    aria-labelledby="empty-state-heading"
    className="panel p-6 text-center md:p-10"
  >
    <h2 id="empty-state-heading" className="break-words text-xl font-bold">{title}</h2>
    {description && <p className="mt-4 break-words leading-7 text-[#5b6e6c]">{description}</p>}
  </section>;
}
