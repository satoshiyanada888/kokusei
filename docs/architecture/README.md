# Architecture

このディレクトリは、KOKUSEIの現在のシステム設計を管理する。将来案や未採用案ではなく、実装済みの構成と責務を記録する。

## システム構成

KOKUSEIは、Next.js Frontend、Go Backend、PostgreSQL Databaseからなる
モノレポである。ローカル開発はDocker Compose、本番公開は
Azure Container AppsとNeon PostgreSQLを使用する。

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
PostgreSQL
```

詳しい設計原則は、既存の[Architecture概要](../architecture.md)を参照する。

## データフロー

1. 外部データProviderが公的機関の一次情報を取得し、値とメタデータを検証する。
2. Backendのserviceがrepositoryを通してPostgreSQLへ保存する。
3. BackendがREST APIから10進文字列として統計値を返す。
4. FrontendがAPIを取得し、一覧、詳細、グラフ、更新履歴として表示する。

外部取得失敗時は既存データを維持し、開発用データと公式データを区別する。

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
- 本番Stage 2: immutable image build/push、Neon Migration、公式データImportとValidation
- 本番Stage 3: digest固定のContainer Apps作成、read-back、Smoke Test、HTTPS公開

本番運用の詳細は
[Azure Container Apps + Neon 初回公開手順](../deployment/azure-container-apps.md)
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
