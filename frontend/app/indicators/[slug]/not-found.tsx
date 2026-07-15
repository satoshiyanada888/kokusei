import Link from "next/link";

export default function NotFound() {
  return <main className="page py-24 text-center"><p className="eyebrow">404</p><h1 className="mt-3 text-3xl font-bold">指標が見つかりません</h1><p className="mt-5 text-[#5b6e6c]">URLを確認するか、ダッシュボードから指標を選択してください。</p><Link href="/" className="mt-8 inline-block text-[#176b5b] underline">ダッシュボードへ戻る</Link></main>;
}

