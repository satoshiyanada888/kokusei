import { InformationPage } from "./InformationPage";
import { legalDocumentDates } from "@/lib/legalDocuments";

export function LegalPageLayout({
  eyebrow,
  title,
  introduction,
  children,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  children: React.ReactNode;
}) {
  return <InformationPage eyebrow={eyebrow} title={title} introduction={introduction}>
    <dl className="panel grid gap-4 p-6 text-base sm:grid-cols-2 md:p-8">
      <div><dt className="font-bold">制定日</dt><dd className="mt-1 text-[#455b58]">{legalDocumentDates.effectiveDate}</dd></div>
      <div><dt className="font-bold">最終更新日</dt><dd className="mt-1 text-[#455b58]">{legalDocumentDates.lastUpdated}</dd></div>
    </dl>
    {children}
  </InformationPage>;
}

export const legalSectionClassName = "panel p-6 md:p-8";
export const legalHeadingClassName = "text-2xl font-bold";
export const legalParagraphClassName = "mt-4 break-words leading-8 text-[#455b58]";
export const legalListClassName = "mt-4 list-disc space-y-3 pl-6 leading-8 text-[#455b58]";
export const legalLinkClassName = "break-all font-semibold text-[#176b5b] underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]";
