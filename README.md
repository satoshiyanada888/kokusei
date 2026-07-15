# KOKUSEI

「日本を、データで知る。」を掲げ、公的機関の一次情報を確認しながら、日本の人口・経済・雇用・物価・少子化の状態を短時間で把握するためのダッシュボードです。ニュースや意見の集約ではなく、利用者が一次情報を確認して自分で判断できることを目指します。

> **データの注意事項**  このリポジトリのシード値は、画面・API・グラフを検証するための開発用サンプルです。実際の最新統計であることを保証せず、意思決定には使用できません。必ず画面からリンクした各機関の一次情報を確認してください。

## MVP の機能

- 総人口、出生数、名目GDP、消費者物価指数、完全失業率の一覧
- 最新値、前回値、増減、対象期間、公開日、取得日時、出典の表示
- 指標ごとの時系列折れ線グラフと、事実から分離した説明
- データ更新履歴
- REST API とヘルスチェック
- PostgreSQL migration と再投入可能な開発用 seed

認証、管理画面、通知、自動データ取得、AI要約はMVPに含みません。

## アーキテクチャ

```text
Browser → Next.js (App Router / TypeScript / Tailwind / Recharts)
                    ↓ REST
          Go API (handler → service → repository)
                    ↓
                PostgreSQL
```

モノレポの主な構成は次のとおりです。

```text
frontend/   Next.js UI、表示ロジックのテスト
backend/    Go API、domain/service/repository/provider、テスト
database/   PostgreSQL migration と seed
docs/       設計メモ
```

`IndicatorRepository` と `UpdateHistoryRepository` がDBアクセスを隠蔽します。将来の外部取得処理は `IndicatorDataProvider` を実装し、保存処理とは独立して追加できます。PostgreSQLでは `numeric(24,6)`、JSONでは10進文字列を使い、バイナリ浮動小数点への暗黙変換を避けています。詳細は [docs/architecture.md](docs/architecture.md) を参照してください。

## 必要なソフトウェア

通常の起動には Docker Desktop（Docker Compose v2）のみ必要です。ホスト上で検証する場合は Go 1.23、Node.js 22、npm 10 も必要です。

## ローカル起動

```bash
cp .env.example .env
docker compose up --build
```

- Web: <http://localhost:3000>
- API: <http://localhost:8080/api/indicators>
- Health: <http://localhost:8080/health>
- PostgreSQL: `localhost:5432`

初回起動時に migration と seed が自動実行されます。停止は `docker compose down`、DBボリュームも初期化する場合は `docker compose down -v` です。

## 環境変数

| 変数 | 既定値 / 用途 |
|---|---|
| `POSTGRES_DB` | `kokusei` |
| `POSTGRES_USER` | `kokusei` |
| `POSTGRES_PASSWORD` | ローカルDBパスワード |
| `DATABASE_URL` | backendからPostgreSQLへの接続URL |
| `NEXT_PUBLIC_API_URL` | ブラウザから参照できるAPI URL（既定 `http://localhost:8080`） |
| `INTERNAL_API_URL` | Next.jsサーバーから参照するAPI URL（Compose内では `http://backend:8080`） |
| `ALLOWED_ORIGIN` | CORSを許可するWeb origin |

本番環境では `.env.example` の認証情報を使用しないでください。

## Migration と seed

新規ボリュームではPostgreSQL公式イメージの初期化機構が自動実行します。起動済みDBへ手動で再実行する場合：

```bash
make migrate
make seed
```

seedは指標・値について冪等です。更新履歴も同じ指標・期間を重複登録しません。migrationのdown SQLは `database/migrations/001_init.down.sql` にあります。

## テスト、lint、build

ホストで初回のみ依存関係をインストールします。

```bash
cd backend && go mod download
cd ../frontend && npm ci
cd ..
make check
```

個別には `make test`、`make lint`、`make build` を利用できます。フロント単体は `npm test`、Go単体は `go test ./...` です。

## API

| Method | Path | 内容 |
|---|---|---|
| GET | `/health` | 稼働確認 |
| GET | `/api/indicators` | 全指標と最新・前回値 |
| GET | `/api/indicators/{slug}` | 指標詳細と全時系列 |
| GET | `/api/updates` | 更新履歴（新しい順） |

値は精度維持のためJSON文字列です。各レスポンスには対象期間、公開日、取得日時、出典名、一次情報URLが含まれます。

## ロードマップ

1. e-Stat・各省庁の提供形式に対応するデータプロバイダーと検証パイプライン
2. 取得失敗・定義変更・欠損値を検知する運用監視
3. 出典側の改定値を履歴として保持するデータバージョニング
4. アクセシビリティ監査、E2Eテスト、長期運用向けバックアップ

