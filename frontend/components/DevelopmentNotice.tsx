export function DevelopmentNotice({ partial = false }: { partial?: boolean }) {
  return <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
    <strong>{partial ? "一部は開発用データ" : "開発用データ"}</strong>：{partial ? "開発用と表示された指標" : "表示値"}は画面・API検証用のサンプルです。実際の最新統計として利用しないでください。
  </div>;
}
