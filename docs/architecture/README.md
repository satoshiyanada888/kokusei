# Architecture

このディレクトリは、KOKUSEIの現在のシステム設計を管理する。将来案や未採用案ではなく、実装済みの構成と責務を記録する。

## システム構成

KOKUSEIは、Next.js Frontend、Go Backend、複数のrepository実装からなる
モノレポである。ローカル開発はDocker ComposeとPostgreSQLを使用する。本番公開は
Azure Container Apps上のBackendが、Managed IdentityでprivateなAzure Blob
Storageから公式JSON snapshotを読み込む。Stage 2もNeon PostgreSQLを使用せず、
公的機関のProviderと直前の検証済みBlob snapshotから次のsnapshotを生成する。

```text
Browser
  |
  v
Next.js Frontend
  |
  v
Go REST API
  |
  v
Azure Blob Storage (private JSON snapshot)

Stage 2 data pipeline
  |
  +-- Official data providers
  +-- Previous Blob snapshot verification / revision comparison
  +-- Immutable JSON snapshot
  +-- Azure Blob Storage upload and current.json switch
```

Backendの永続化先は`DATA_STORE=postgres|blob|file`で選択する。`blob`は
Managed Identityでprivate containerの`current.json`を読み、そこから
commit SHA固定の`dataset.json`を取得する。`file`は同じschemaをAzureなしで
検証するためのローカル実装である。

詳しい設計原則は、既存の[Architecture概要](../architecture.md)を参照する。

## データフロー

1. Stage 2で外部データProviderが公的機関の一次情報を取得する。
2. `current.json`が指す直前のsnapshotをSHA-256付きで検証し、同一期間の値変更だけを更新履歴へ追加する。新規期間は改訂として扱わない。
3. 公式値、schema、出典、更新履歴を検証したimmutableな`dataset.json`をBlobへupload・read-backする。
4. 最後に`current.json`を切り替え、本番Backendが新しいsnapshotを参照する。
5. BackendがREST APIから10進文字列として統計値を返す。
6. FrontendがAPIを取得し、一覧、詳細、グラフ、更新履歴として表示する。

外部取得失敗時は既存データを維持し、開発用データと公式データを区別する。
ローカル開発では従来どおりPostgreSQL repositoryを使用する。

Blob snapshot経路ではStage 2が3つのProviderから正規化済み公式値を取得し、
全検証後に`dataset.json`をupload・read-backする。最後に`current.json`を更新する
ため、Backendが部分uploadを読むことはない。Backendは同じcommitをmemory cache
から返し、一時的なBlob取得失敗では直前の正常cacheを維持する。

## コンポーネント

- `frontend/`: Next.js App Routerによる画面、表示ロジック、Rechartsグラフ
- `backend/`: HTTP handler、service、repository、外部データProvider
- `database/`: PostgreSQL migrationとローカル開発用seed
- `infra/`: Azure Production基盤のTerraform
- `.github/workflows/`: CIと手動承認式Production Workflow

Backendはhandler、service、repositoryの責務を分離する。`IndicatorDataProvider`は取得、repositoryは永続化だけを担当する。

## API構成

- `GET /health`
- `GET /api/indicators`
- `GET /api/indicators/{slug}`
- `GET /api/updates`

APIの既存レスポンス形式は後方互換性を維持し、統計値は精度保持のため10進文字列で返す。

## インフラ構成

- ローカル: Docker ComposeによるFrontend、Backend、PostgreSQL
- 本番Stage 1: Azure Container Registry、Container Apps Environment、
  Log Analytics、Managed Identity、OIDC/RBAC
- 本番Stage 2: immutable image build/push、公式Provider取得、直前snapshotとの差分履歴生成、
  JSON snapshotのBlob upload・read-back・`current.json`切替
- 本番Stage 3: digest固定のContainer Apps作成、read-back、Smoke Test、HTTPS公開
- 本番データ参照: app-data専用StorageV2、private container、Backend Readerと
  GitHub deploy Contributorのcontainer限定RBAC。Productionは`DATA_STORE=blob`

本番運用の詳細は
[Azure Container Apps本番公開手順](../deployment/azure-container-apps.md)
を参照する。

## ディレクトリ構成

```text
/
├── frontend/
├── backend/
├── database/
├── infra/
├── docs/
│   ├── architecture/
│   ├── knowledge/
│   ├── decisions/
│   └── runbooks/
├── .github/workflows/
├── docker-compose.yml
├── Makefile
└── README.md
```

リポジトリ全体の目的と起動方法は[ルートREADME](../../README.md)を参照する。
