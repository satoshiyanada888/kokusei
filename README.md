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

## Azure Container Appsへの本番デプロイ

Azure Container Registry、Azure Container Apps、Neon PostgreSQL、GitHub Actions OIDCを使う本番構成を`infra/`と`.github/workflows/`に用意しています。Stage 1（Azure基盤）、Stage 2（Neon Migration・公式データ・image）、Stage 3（公開）に分け、Stage 1ではアプリを作成・公開しません。Secret、Remote State、Migration、公式データ、コスト、ロールバックの手順は [docs/deployment/azure-container-apps.md](docs/deployment/azure-container-apps.md) を参照してください。

Terraformコードの作成だけではAzureリソースは作られません。Subscription、権限、料金、Resource Group、名前衝突を確認し、`terraform plan`の内容について承認を得てからapplyしてください。Neon pooled/direct URLはGitHub `production` Environment Secretsからのみ渡し、Git、tfvars、saved plan、Terraform Stateへ保存しません。出生数と完全失業率の公式取得仕様は [docs/data-sources/births-and-unemployment.md](docs/data-sources/births-and-unemployment.md) を参照してください。

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

### スマートフォンからアクセスする

Macとスマートフォンを同じWi-Fiに接続し、Docker Composeを起動した状態で次を実行します。

```bash
make lan-url
```

表示されたURL（例：`http://192.168.0.21:3000`）をスマートフォンのブラウザで開いてください。MacのIPアドレスはネットワーク接続時に変わる場合があるため、接続できなくなった場合は再度 `make lan-url` を実行します。

macOSのファイアウォールが接続確認を表示した場合は、同一Wi-FiからのNode.js / Dockerへの受信接続を許可してください。会社・ゲストWi-Fiなど端末間通信を遮断するネットワークでは利用できません。WebはLANへ公開されますが、PostgreSQLポートは安全のためMac自身からのみ接続できます。

## 環境変数

| 変数 | 既定値 / 用途 |
|---|---|
| `POSTGRES_DB` | `kokusei` |
| `POSTGRES_USER` | `kokusei` |
| `POSTGRES_PASSWORD` | ローカルDBパスワード |
| `DATABASE_URL` | backendからPostgreSQLへの接続URL |
| `NEXT_PUBLIC_API_URL` | ブラウザから参照できるAPI URL（既定 `http://localhost:8080`） |
| `NEXT_PUBLIC_SITE_URL` | canonical URL、OGP、sitemap、robotsに使用する公開サイトURL（未設定時 `http://localhost:3000`） |
| `INTERNAL_API_URL` | Next.jsサーバーから参照するAPI URL（Compose内では `http://backend:8080`） |
| `ALLOWED_ORIGIN` | CORSを許可するWeb origin |
| `ESTAT_APP_ID` | 出生数のe-Stat API取得に必要なapplication ID。人口・完全失業率importでは未使用 |
| `ESTAT_POPULATION_STAT_INF_ID` | 人口推計「全国人口の推移」のe-Statファイル統計表ID。既定は2026年6月公表分 |
| `ESTAT_POPULATION_PUBLISHED_AT` | 対象統計表の公表日（既定 `2026-06-19`） |

本番環境では `.env.example` の認証情報を使用しないでください。
公開前に`NEXT_PUBLIC_SITE_URL`を本番サイトのHTTPS URLへ設定し、Frontendを再ビルドしてください。末尾のスラッシュはどちらでも構いません。

## 総人口の公式データ取得

総人口のみ、総務省統計局「人口推計」の月次確定値をe-Statの公式Excelから取得できます。この統計表はe-Stat APIの統計データ取得対象ではないため、APIキーは使用しません。取得元、指標定義、単位変換、更新頻度、利用条件は [docs/data-sources/population.md](docs/data-sources/population.md) に記録しています。

```bash
make migrate
make fetch-population
```

取得処理は公式レスポンスを検証してからPostgreSQLへ保存します。同じ期間・同じ値は登録せず、値が変わった場合だけ更新履歴を作成します。取得・検証・保存のいずれかが失敗した場合は既存データを維持します。総人口の公式値が一度も保存されていない環境では、従来の開発用seedが表示されます。

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

PostgreSQL repository統合テストは、Composeを起動してmigrationを適用した後に実行します。

```bash
make test-integration
```

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
