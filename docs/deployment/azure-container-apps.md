# Azure Container Apps + Neon 初回公開手順

2026-07-16時点のKOKUSEI本番構成。Production apply、Neon作成、本番Migration、GitHub設定はまだ実施していない。

```text
利用者
  └─ HTTPS → Frontend Container App (external, min 0)
                  └─ INTERNAL_API_URL → Backend Container App (internal, min 0)
                                                └─ TLS/pooled → Neon PostgreSQL
GitHub Actions ── TLS/direct → Migration・Importer・Validation
```

Azure PostgreSQL Flexible Server、VNet、subnet、Private DNS、database password Terraform変数は現行構成から除外した。NeonはTerraform管理せず、接続URLはTerraform plan/stateへ渡さない。

## Stage 1: Azure基盤

Terraformが作るのはResource Group、ACR Basic、Log Analytics、Consumption Container Apps Environment、Frontend・Backend・GitHub OIDC用の3つのUser Assigned Identityと必要なrole assignmentだけ。Container App、Job、VNet、DBは作らず、サービスは公開されない。

```bash
cd infra/environments/production
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive ../../
terraform validate
terraform plan
# planの別承認後だけ terraform apply
```

## Neonを手動作成する

1. Neonアカウントを作り、ConsoleでFree planの現行上限を確認する。
2. Projectを作成する。Azure Container AppsはJapan East。Neonに日本リージョンは公式一覧上なく、最寄り候補はAWS Asia Pacific (Singapore)。AWS Sydneyも候補だが、距離・一般的な地理からSingaporeを第一候補とする。作成画面により利用可能リージョンが異なる可能性があるため最終選択はConsoleで確認する。
3. 実ProjectはPostgreSQL 18で作成されている。Migration・Importer・Backendを実PostgreSQL 18.4へ接続して検証する。ローカルDocker Composeは互換性確認用としてPostgreSQL 16を維持する。
4. ConsoleでMigration roleを作り、ownerに指定してdatabase名`kokusei`を作る。Backend roleはMigration roleからSQL `CREATE ROLE`で作成する。
5. Free planではcomputeは非活動5分後に固定でscale to zero。autoscaling上限は初回公開の最小値から開始し、Consoleでconnection/storage/compute上限を確認する。
6. Connect画面からBackend roleのpooled URLとMigration roleのdirect URLを取得する。URLを加工せず、TLS queryを含む全体をSecretへ保存する。

日本からSingapore Neonへの通信はクラウド/リージョン間通信となり、同一リージョンDBより遅延と外部通信障害面が増える。公開統計の小規模・read-heavyサービスでは暫定的に許容する判断だが、実測前であり、個人情報を扱わないことを前提とする。データ所在地は日本ではなくSingaporeとなる。

## DB role

- Migration role: database/schema ownerとしてDDL、Migration、公式データupsert、Validationを実行する。通常Backendでは使用しない。
- Backend role: `CONNECT`、public schema `USAGE`、KOKUSEI tablesの`SELECT`だけ。`TEMPORARY`、`CREATEDB`、`CREATEROLE`、schema/table作成・変更・削除、extension管理を与えない。Console/API roleは`neon_superuser`へ自動所属するため使用せず、Database ownerからSQLで作成する。
- BackendのrepositoryはGET API用のSELECTだけを実行する。ImporterはMigration direct URLを使うためBackend roleにwrite権限は不要。

Migration roleとDatabaseはNeon Consoleで作る。Backend roleはConsole/APIで作らず、Database ownerであるMigration roleから`CREATE ROLE kokusei_backend LOGIN PASSWORD ... NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`で作る。NeonではSQL作成roleだけが`neon_superuser`へ自動所属しない。Migration実行前に`APP_DATABASE_USER`としてBackend role名を渡すと、Migration scriptが非特権状態を検証してからread-only grant/default privilegeを再適用する。roleがない、または特権が残る場合は失敗する。

Migration roleのpassword rotationはConsoleを使用する。SQL作成のBackend roleはMigration roleから`ALTER ROLE kokusei_backend PASSWORD ...`でrotationし、pooled URLのpasswordとGitHub Secretを更新してWorkflowを再実行する。Backend Secret更新は新revisionへ反映される。旧passwordの失効と新revisionのhealthを確認する。

## 接続URLとTLS

GitHub `production` Environment Secrets:

- `NEON_DATABASE_URL`: Backend roleのpooled URL。通常API接続と接続数抑制用。hostに`-pooler`を含む。
- `NEON_MIGRATION_DATABASE_URL`: Migration roleのdirect URL。DDL、Importer、Validation用。
- `ESTAT_APP_ID`: 出生数e-Stat API用。

Neon Consoleが発行する`sslmode=require&channel_binding=require`等を含むURLを優先し、`sslmode=disable`はWorkflowが拒否する。pgx v5とpsql 18で実URLを検証済み。Backend AlpineとMigration PostgreSQL imageにはCA certificatesが入る。`sslmode=require`はTLSを暗号化するが通常のlibpqにおける`verify-full`とは検証方式が異なる。Neon推奨のchannel bindingを維持する。

ローカルDocker Composeだけは`sslmode=disable`のローカルPostgreSQLを使う。

## GitHub Production Environment

Settings > Environmentsで`production`を手動作成し、Required Reviewerとmain branchだけのdeployment branch ruleを設定する。未設定のまま設定済みと扱わない。

Secrets:

- `NEON_DATABASE_URL`
- `NEON_MIGRATION_DATABASE_URL`
- `ESTAT_APP_ID`

Variables:

- `AZURE_CLIENT_ID`: Terraform `github_actions_client_id`
- `AZURE_TENANT_ID`: 対象Tenant
- `AZURE_SUBSCRIPTION_ID`: 対象Subscription
- `AZURE_RESOURCE_GROUP`: Terraform `resource_group_name`
- `AZURE_CONTAINER_REGISTRY`: Terraform `container_registry_name`
- `AZURE_CONTAINER_APP_ENVIRONMENT`: Terraform `container_app_environment_name`
- `AZURE_CONTAINER_APP_FRONTEND`: `kokusei-prod-frontend`
- `AZURE_CONTAINER_APP_BACKEND`: `kokusei-prod-backend`
- `FRONTEND_IDENTITY_ID`: Terraform `frontend_identity_id`
- `BACKEND_IDENTITY_ID`: Terraform `backend_identity_id`
- `APP_DATABASE_USER`: Neon Backend role名
- `NEXT_PUBLIC_SITE_URL`: 下記の初回FQDN

OIDC identifiersはpasswordではないためVariablesとする。実値を推測して設定しない。

## Stage 2: imageとDB準備

`.github/workflows/deploy-production.yml`は`workflow_dispatch`のみ。Frontend/Backend検証後、3 imageをRunner上でSHA tag buildする。ACRへpushするのはFrontendとBackendだけで、Migration imageはRunnerにのみ残す。

ACRで両SHA tagを確認後、次の順で進む。

1. Neon direct URLでMigration
2. 出生数import → validation
3. 完全失業率import → validation
4. 人口import → validation
5. 3指標横断validation

Migration imageの`schema_migrations`により再実行は安全で、各migrationはtransaction。Importerはindicator単位のtransaction/advisory lockとupsertを使い、同一値は重複せず改訂値だけhistoryを記録する。fixture/mock/sample環境変数を本番Workflowへ渡さない。いずれかが失敗するとshellの`set -e`でApps作成前に停止する。

公式系列・checksum・代表値は[出生数・完全失業率](../data-sources/births-and-unemployment.md)と[人口](../data-sources/population.md)を参照。

## Stage 3: Container Apps公開

Stage 2成功後だけBackendを作成/更新する。

- Backend: internal ingress、port 8080、0.25 vCPU/0.5 GiB、min 0/max 2、non-root、専用Managed IdentityによるACR pull。`/health`をStartup/Liveness/Readiness probeに使う。
- `NEON_DATABASE_URL`をAzure Container Apps Secret `neon-database-url`へCLIで登録し、`DATABASE_URL=secretref:neon-database-url`。Terraformへ渡さない。
- pgx poolは1 replicaあたり最大5接続（最大2 replicaで合計最大10接続）。既定のconnect timeoutとstatement timeoutは各10秒で、URLに明示値があればそれを優先する。起動時DB pingはNeon/Container Apps双方のcold startを考慮して最大約40秒retryする。
- Backend healthと3詳細APIを同一Container Apps Environment内の一回限りSmoke Jobで確認する。
- 成功後にFrontendをexternal ingress、port 3000、0.25 vCPU/0.5 GiB、min 0/max 2で作成/更新し、server-side `INTERNAL_API_URL`でBackend internal FQDNへ接続する。ブラウザからBackendへ直接接続しない。

WorkflowはSecret値を含むBackend仕様をRunnerの一時JSONへ生成し、`az containerapp create/update --yaml`へ渡す。JSONはRunner終了時に破棄され、Git、artifact、Terraform、Docker imageへ保存しない。Workflowログにも接続URLを明示出力しない。

Smoke JobはMigration imageではなくBackend imageの`/smoke-test`を使用する。これはACRに既に存在するBackend SHA imageの再利用であり、Migration Container Apps Jobではない。

## NEXT_PUBLIC_SITE_URL初回設定

Container Apps Environmentのdefault domainと固定app名から、Terraform `expected_frontend_url`が予定HTTPS FQDNを出力する。Stage 1 apply後にこの値を確認し、Azure Portal/CLIで想定nameとdomainを照合してGitHub Variableへ設定する。これにより仮Frontend app/imageを作らず正式buildできる。

初回だけWorkflowはFrontendをinternal ingressで作成し、実FQDNと`NEXT_PUBLIC_SITE_URL`が一致した後にexternalへ変更する。不一致ならinternalのまま失敗するため、localhost/仮URLを公開状態に残さない。URL変更時はVariable更新後に新commit SHAのFrontendを再build/deployする。最後にcanonical、`og:url`、`og:image`、Twitter image、sitemap、robotsをHTTPS URLで検証する。

## scale to zeroと障害対応

Frontend/Backendはmin 0。Neon Freeも5分でscale to zeroするため、初回requestではContainer AppsとDB双方のcold startが重なり、数秒以上の遅延や最初のrequest timeoutが起こり得る。実測後、必要ならBackendまたはFrontendをmin 1へ変更するが、常時課金が増えるため別レビューとする。

切り分け順:

1. Neon regional statusとcompute状態
2. GitHub WorkflowのMigration/validation exit code（URLは表示しない）
3. Backend revision healthとContainerAppConsoleLogs
4. Frontend revision/HTTPS
5. pooled/direct URLのrole、database、TLS、rotation状態

## Log Analytics

Workspaceは`PerGB2018`、保持30日。Container Apps EnvironmentはLog Analyticsなしでも構成可能な方式があるが、初回障害確認のため明示Workspaceを維持する。ログ対象はContainer Apps system/console logsだけ。実稼働量がないため月額と適切なDaily Capは未確定。Daily Cap到達時は収集停止で障害調査不能になるため、初回はBudget通知を優先し、公開後の実量を見て設定する。Secret/URL/tokenをログへ出さない。

BudgetはStage 1 apply後、Azure PortalのCost Management > BudgetsでProduction Resource Groupをscopeにして作成する。予算上限額と通知先は所有者が決め、50%・80%・100%のactual cost通知を候補として登録する。今回のコードや作業ではBudgetを作成せず、通知先も設定していない。

## State

Production Remote Stateはprivate Azure Blobで、現時点では空。Neon URLとGitHub SecretはTerraform入力に存在しないためplan/stateへ入らない。Bootstrap Stateは同じprivate containerの`bootstrap.tfstate`へremote移行済みで、Blob lease lock、versioning、14日削除保持を使用する。

Storage Account自身を同じStateが管理する循環は残る。Storage削除前にはStateを別backend/暗号化backupへ移す。復旧はBlob Data Contributor権限を戻し、backend.hclを再作成して`terraform init -reconfigure`する。

## ロールバック・削除・課金停止

Container AppsはMultiple revisions。既知の正常revisionへtrafficを100%戻す。DB migrationは自動rollbackしない。破壊的down migrationは別承認とbackup/branch確認が必要。

Azure課金停止はContainer Apps削除、ACR image/repository整理、Workspace/RG削除をplanで確認後に行う。Remote State RGはProduction RGと別なので誤削除しない。Neon Project削除は全database/branch/historyを失うため、必要なexportとProject ID/対象確認後に手動実行する。Free上限超過、paid plan移行、storage/compute/egressはNeon Console Billingで確認する。

ACRはFrontend/Backendのcommit SHA imageだけを保持し、rollbackに必要な直近世代以外は別承認で整理する。`latest`は使わない。

## コストの扱い

- Neon Free: 公式価格ページでは1 projectあたり月100 CU-hours、0.5 GB storage、非活動5分でscale to zero、public transfer 5 GBを含む。上限内なら$0。超過時に自動課金か停止かは選択plan/Consoleで確認する。
- ACR Basic: 固定課金。2026-07-16のAzure Retail Prices API（Japan East、USD）では$0.1666/日、30日月で$4.998、31日月で$5.1646。契約通貨のJPY請求額はPricing Calculatorでapply前に再確認する。
- Container Apps: min 0ならrequest/active compute等の従量課金。無料grant適用と実額は未確認。
- Log Analytics: ingestion/retention従量。実ログ量がないため未確定。
- Remote State Storage:小容量Blob/storage transaction。実額未確定。
- Azure↔AWS Singapore、Neon public egress、インターネット転送:方向と量で変動し未確定。

Azure PostgreSQLの推定約4,592.30円/月は新構成から除外される。したがって最低固定費は主にACR Basicへ減るが、確定差額はACR/転送/為替/税をPricing Calculatorで確認するまで算出しない。

| 利用パターン | Container Apps | Neon | ACR・Log Analytics・State・転送 | 確定月額 |
|---|---|---|---|---|
| 最小利用（ほぼアクセスなし） | min 0のためscale to zero。Subscription全体の月180,000 vCPU秒、360,000 GiB秒、200万requestの無料grant内ならcompute/requestは$0 | 100 CU-hours、0.5 GB、5 GB public transfer内なら$0 | ACR Basicは30日で$4.998。Workspace ingestion、Blob容量/operation、転送は実量課金 | 最低固定費の目安はACRの約$5/月。JPY総額は未確定 |
| 通常利用（月間数千PV） | 起動時間、request数、同一Subscriptionの無料grant消費量次第 | query稼働時間、storage、transferがFree上限内か次第 | image世代数とログ量が増える | PVだけでは各meter量を算出できず未確定 |
| 月間1万PV | 1 PVあたりのHTTP request数と処理時間次第。PV数だけでは200万request grant内と断定しない | API query数、cold start後の5分稼働、転送量次第 | Log AnalyticsとAzure↔Neon通信量の影響が増える | 負荷計測前のため未確定 |

2026-07-16確認時点の公式仕様を基準とする。Japan EastのContainer Apps超過単価はvCPU active $0.000024/秒、memory active $0.000003/GiB秒、request $0.40/100万件。Log Analytics Analytics Logs ingestionはRetail Prices API上で最初の5 GBが$0、その後$3.34/GBのmeterを持つ。ただし、Subscription全体のgrant消費、契約、税、為替を含むJPY総額は推測しない。Stage 1 apply前にPricing CalculatorでACR Basic、Log Analytics、Container Apps、Storage、bandwidthを対象Subscription条件で保存し、Neon Consoleでも選択planの上限を再確認する。
