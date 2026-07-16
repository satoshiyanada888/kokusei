import Link from "next/link";

export function InformationPage({
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
  return <main className="page py-12 md:py-16">
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="inline-flex min-h-11 items-center rounded-md text-sm font-semibold text-[#176b5b] underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#176b5b]">← トップページへ戻る</Link>
      <header className="mt-10">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-3 break-words text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-5 break-words text-lg leading-8 text-[#5b6e6c]">{introduction}</p>
      </header>
      <div className="mt-10 space-y-6">{children}</div>
    </div>
  </main>;
}
