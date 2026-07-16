"use client";

import { useTransition } from "react";
import Link from "next/link";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [isPending, startTransition] = useTransition();

  return <html lang="ja">
    <body style={{ margin: 0, background: "#f5f7f3", color: "#102a2a", fontFamily: "Arial, sans-serif" }}>
      <main role="alert" aria-labelledby="global-error-heading" style={{ width: "min(640px, calc(100% - 32px))", margin: "0 auto", padding: "80px 0", textAlign: "center" }}>
        <p style={{ color: "#176b5b", fontWeight: 700, letterSpacing: ".12em" }}>KOKUSEI</p>
        <h1 id="global-error-heading" style={{ marginTop: 16, fontSize: 32 }}>問題が発生しました</h1>
        <p style={{ marginTop: 20, lineHeight: 1.8, color: "#5b6e6c" }}>現在、このページを表示できません。時間をおいて、もう一度お試しください。</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginTop: 32 }}>
          <button
            type="button"
            onClick={() => startTransition(reset)}
            disabled={isPending}
            aria-busy={isPending}
            style={{ minHeight: 48, border: 0, borderRadius: 12, background: "#176b5b", color: "white", cursor: isPending ? "wait" : "pointer", fontWeight: 700, padding: "12px 24px" }}
          >{isPending ? "再試行しています…" : "もう一度試す"}</button>
          <Link href="/" style={{ minHeight: 48, border: "1px solid #176b5b", borderRadius: 12, color: "#176b5b", fontWeight: 700, padding: "12px 24px", textDecoration: "none" }}>トップページへ戻る</Link>
        </div>
      </main>
    </body>
  </html>;
}
