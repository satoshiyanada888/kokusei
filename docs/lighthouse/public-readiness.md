# 公開前品質確認（Lighthouse・モバイル・アクセシビリティ）

実施日: 2026-07-15

## 実装前の構成確認

- Next.js 15.5.20 / React 19.0.0 / Recharts 3.9.2 / Tailwind CSS 4.0.14
- Tailwindのモバイルファーストなutility classを使用し、主に`sm`、`md`、`lg`で切り替え
- フォントはOS標準の日本語フォントスタックで、外部Webフォントなし
- ロゴはSVG、Apple touch iconとOGPは寸法を固定したPNG。OGP画像は画面本文では読み込まない
- Client Componentはグラフ、再試行、Error Boundary関連に限定
- 外部スクリプト、アクセス解析、既存Lighthouse CI設定なし
- Vitest + Testing Libraryを使用。`eslint-plugin-jsx-a11y`、Playwright/Cypress、axe専用ライブラリは未導入
- Docker ComposeのFrontend production buildを品質確認対象とした

## 計測条件

- Docker Composeで生成したNext.js production buildを`http://localhost:3000`で計測
- Lighthouse CLI 13.4.0 / Headless Chrome 150
- Mobile: Lighthouse既定のモバイルエミュレーション
- Desktop: Lighthouse desktop preset
- 評価カテゴリ: Performance / Accessibility / Best Practices / SEO
- 巨大なLighthouse JSON/HTMLはGit管理せず、要点をこの文書へ記録

## 最終スコア

| ページ | 条件 | Performance | Accessibility | Best Practices | SEO | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| トップ（指標一覧） | Mobile | 100 | 100 | 100 | 100 | 0.8秒 | 1.7秒 | 20ms | 0 |
| 人口詳細 | Mobile | 100 | 100 | 100 | 100 | 0.9秒 | 1.9秒 | 40ms | 0 |
| データ出典 | Mobile | 100 | 100 | 100 | 100 | 0.8秒 | 1.8秒 | 30ms | 0 |
| トップ（指標一覧） | Desktop | 100 | 100 | 100 | 100 | 0.2秒 | 0.4秒 | 0ms | 0 |

プライバシーポリシーは共通修正前のモバイル計測でも全カテゴリ100でした。404は正しいHTTP 404を返すためLighthouse CLIが採点対象として完走せず、スコアは未計測です。

## Lighthouseで検出した問題と対応

| 検出内容 | 影響 | 対応 |
| --- | --- | --- |
| 動的ページのmeta descriptionがストリーミングにより`body`側へ出力され、SEO監査が認識しない | SEO 91 | `htmlLimitedBots`を設定し、計測・クローラー向けHTMLでmetadataを`head`内へ確実に出力 |
| グラフの`aria-label`がラベルを受け取れない要素に付いていた | Accessibility 92 | グラフコンテナを`role="img"`として、目的をアクセシブルネームで表現 |
| 12px補足文字のコントラストが4.38:1 | Accessibility 92 | 文字色を`#5b6e6c`へ変更 |
| 次の指標リンクのアクセシブルネームに表示中の矢印が含まれない | Accessibility 92 | 表示文字列と一致する`aria-label`へ修正 |
| 一部ナビゲーションリンクのタップ領域が小さい | モバイル操作性 | ヘッダー、ロゴ、戻るリンクを最小44px高へ変更し、フォーカスリングを明示 |
| 404ページのページ固有metadataが不足 | SEO / 誤index防止 | 専用titleと`noindex, nofollow`を追加 |

再計測では上記監査はすべて解消しました。`bf-cache`監査には動的ページの`Cache-Control: no-store`が残りますが、Lighthouse自身が「Not actionable」と分類しBest Practicesスコアへの減点はありません。統計の鮮度に関わるキャッシュ仕様をこの品質確認だけで変更しない方針としました。

## レスポンシブ・実画面確認

320px、360px、375px、390px、768pxで、トップ、人口・出生数・完全失業率の詳細、データ出典、プライバシーポリシー、存在しないURLを確認しました。

- 全対象でページ全体の横方向オーバーフローなし
- ヘッダー、ロゴ、カード、フッター、関連指標、前後ナビゲーションの衝突なし
- 320px時の詳細グラフは231×320px、トップのミニグラフは207×112pxで判別可能
- 360px時の詳細グラフは271×320px、ミニグラフは247×112px
- 375px時の詳細グラフは286×320px、ミニグラフは262×112px
- 390px時の詳細グラフは301×320px、ミニグラフは277×112px
- 768px時の詳細グラフは655×320px、ミニグラフはカード内119×80px
- 主要リンクのタップ領域は320px確認時に44px以上
- 各確認ページで`h1`と`main`は1つ、重複ID・alt欠落・識別不能な`nav`なし
- 人口→出生数→人口の前後リンク遷移、404からの復旧導線を実ブラウザで確認
- 404は専用title、`noindex`、HTTP 404を確認

グラフの最新値、増減、最大・最小、期間、単位は本文の「この指標の要点」と公式データでも確認でき、SVGやtooltipだけに重要情報を閉じ込めていません。データ0件は`EmptyState`、取得失敗は`ErrorState`と再試行ボタンのコンポーネントテストで確認しています。

## SEO・Best Practices確認

- 公開ページにtitle、description、canonical、`lang="ja"`、h1あり
- 動的ページのdescriptionが実際のHTML `head`内にあることを確認
- `robots.txt`、`sitemap.xml`、`/og-image.png`はHTTP 200
- 存在しないURLはHTTP 404かつ`noindex`
- 外部リンクは新規タブ利用箇所で`noopener noreferrer`を指定
- ブラウザ確認で重大なコンソールエラー、hydration mismatch、404アセット、重複IDなし
- ローカル計測のcanonicalは意図どおりlocalhost。本番ビルド時は`NEXT_PUBLIC_SITE_URL`に公開先のHTTPS URLを必ず設定する

## 確認範囲と未実施事項

- Chrome系（Lighthouse Headless ChromeとCodex内ブラウザ）で確認。Safari実機・Firefox実機は利用環境がないため未確認
- Tab移動でフォーカス可能要素と視認できるフォーカススタイルを確認。自動ブラウザ経由のEnter入力だけはNext.jsリンク遷移を再現できなかったため未確認とし、ネイティブ`a[href]`、クリック遷移、コンポーネントテストで補完
- Spaceはネイティブリンクの起動キーではない。再試行はネイティブ`button`としてテスト済みだが、実API障害を発生させる操作は既存データ保護のため未実施
- 画面読み上げソフトによる実聴取テストは未実施
- Backend、DB、migrationは変更していないためGoテストとmigration rollbackはこのIssueでは省略

公開を妨げる既知の未解決問題はありません。ただし、公開時の`NEXT_PUBLIC_SITE_URL`設定とSafari/Firefoxでの最終スモークテストはデプロイ手順に含めてください。
