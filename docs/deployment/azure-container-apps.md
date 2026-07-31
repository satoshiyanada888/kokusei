# Azure Container Apps + Neon 初回公開手順

KOKUSEIの初回公開構成。Neon PostgreSQLの作成・実接続検証とAzure Production Stage 1 applyは完了している。Container Apps本体とACR imageはまだ作成していない。GitHub `production` Environmentの実設定は、Workflow実行前に値を表示せず再確認する。

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

2026-07-21のread-only確認では`rg-kokusei-prod`は存在せず、Bootstrap用`rg-kokusei-tfstate`は`Deleting`、残存リソースは0件だった。Remote State用Storage Accountとprivate containerが利用可能になるまで、Productionの`terraform init`、plan、applyへ進まない。Bootstrap復旧・再作成は別planと承認を必要とする。

```bash
cd infra/environments/production
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive ../../
terraform validate
terraform plan -out=production-stage1.tfplan
../../../scripts/production/check-stage1-plan.sh production-stage1.tfplan
terraform show -no-color production-stage1.tfplan
# planの別承認後だけ、同じsaved planをapplyする
terraform apply production-stage1.tfplan
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

Secrets・Variablesの取得元、Stage 1 saved plan、OIDC/RBAC確認、実行・中止・再実行・rotation・rollbackの手順は[GitHub Production Environment 設定・実行手順](github-production-configuration.md)を参照する。

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
- `ACR_LOGIN_SERVER`: Terraform `container_registry_login_server`
- `AZURE_CONTAINER_APP_ENVIRONMENT`: Terraform `container_app_environment_name`
- `AZURE_CONTAINER_APP_FRONTEND`: `kokusei-prod-frontend`
- `AZURE_CONTAINER_APP_BACKEND`: `kokusei-prod-backend`
- `FRONTEND_IDENTITY_ID`: Terraform `frontend_identity_id`
- `BACKEND_IDENTITY_ID`: Terraform `backend_identity_id`
- `APP_DATABASE_USER`: Neon Backend role名
- `NEXT_PUBLIC_SITE_URL`: 下記の初回FQDN

OIDC identifiersはpasswordではないためVariablesとする。実値を推測して設定しない。

## Stage 2: imageとDB準備

`.github/workflows/prepare-production.yml`はStage 2専用の`workflow_dispatch`である。Frontend/Backend検証後、3 imageをRunner上で完全なcommit SHA tagとしてbuildし、platformを`linux/amd64`へ固定する。ACRへpushするのはFrontendとBackendだけで、Migration imageはRunnerにのみ残す。

実行前にGitHub上の`main` HEADが事前レビュー済みcommitと一致することを確認し、40文字の完全SHAを`expected_commit_sha`へ入力する。短縮SHAや既定値は使用しない。Environment承認前のvalidate jobが入力形式を確認し、大小文字を正規化したうえで`github.sha`と完全一致しなければ停止する。事前レビューしたSHA以外のrunは承認しない。

同じSHA tagが既にACRにある場合は内容にかかわらず上書きせず停止する。push後に両image digestとmanifestのOS・architectureを検証してから、次の順で進む。

Stage 2とStage 3は同じ`ACR_LOGIN_SERVER`を使用し、`AZURE_CONTAINER_REGISTRY`から期待される`<registry-name>.azurecr.io`とAzure login前に完全一致検証する。login serverはTerraform `container_registry_login_server` outputからEnvironment Variableへ転記し、`az acr show`では取得しない。GitHub deploy identityは対象ACRの`AcrPush`だけを維持し、Registry一般参照用のReaderは追加しない。不一致ならStage 2はpush前、Stage 3はContainer Apps変更前に停止する。

1. Neon direct URLでMigration
2. 出生数import → validation
3. 完全失業率import → validation
4. 人口import → validation
5. 3指標横断validation

Migration imageの`schema_migrations`により再実行は安全で、各migrationはtransaction。Importerはindicator単位のtransaction/advisory lockとupsertを使い、同一値は重複せず改訂値だけhistoryを記録する。fixture/mock/sample環境変数を本番Workflowへ渡さない。いずれかが失敗するとshellの`set -e`でApps作成前に停止する。

成功時はcommit SHA、Frontend/Backendのtag付きURI・digest・platform、Migration・Import・Validation結果をjob summaryと30日保持のartifactへ保存する。artifactには接続URL、password、API keyを含めない。Stage 2はContainer Appsを操作せず、Stage 3を起動せずに終了する。

公式系列・checksum・代表値は[出生数・完全失業率](../data-sources/births-and-unemployment.md)と[人口](../data-sources/population.md)を参照。

## Stage 3: Container Apps公開

`.github/workflows/deploy-production.yml`はStage 3専用の別の`workflow_dispatch`である。Stage 2のjob summaryまたはartifactを人が確認し、Stage 2 Run ID、完全なcommit SHA、Frontend digest、Backend digestを手動入力してRequired Reviewerが承認した場合だけ実行する。Stage 3はDocker buildとACR pushを行わない。

- Environment承認前のvalidate jobは、指定Run IDが同じrepositoryの`Prepare production (Stage 2)`、`workflow_dispatch`、`main`、`completed/success`、attempt 1、入力commit SHAであることをGitHub APIで確認する。入力commit SHAはStage 3の`github.sha`とも完全一致し、過去のmain commitは公開しない。
- 指定Run IDに所属する有効な`production-stage2-<commit SHA>`が1件だけ存在することを確認し、そのartifact IDを直接取得する。metadataのcommit SHA、両digest、`linux/amd64`、Migration、3 Import、全Validationを入力値と完全一致検証する。他runや同名複数artifactを最新順で選ばない。
- Stage 3 Workflow自体を変更したcommitでは、その新commitを対象にStage 2を改めて1回実行して新しいartifactとdigestを作る。古いStage 2 artifactを新しいWorkflow SHAへ流用しない。
- Stage 3は入力digestがACRに存在し、入力commit SHA tagと対応し、`linux/amd64`であることを再確認する。Container AppsとSmoke Jobはtagではなく`repository@sha256:...`を使用する。
- Backend: internal ingress、port 8080、0.25 vCPU/0.5 GiB、min 0/max 2、non-root、専用Managed IdentityによるACR pull。`/health`をStartup/Liveness/Readiness probeに使う。現在の`/health`はprocess-onlyで、起動後のDB接続状態は確認しない。
- `NEON_DATABASE_URL`をAzure Container Apps Secret `neon-database-url`へCLIで登録し、`DATABASE_URL=secretref:neon-database-url`。Terraformへ渡さない。
- pgx poolは1 replicaあたり最大5接続（最大2 replicaで合計最大10接続）。既定のconnect timeoutとstatement timeoutは各10秒で、URLに明示値があればそれを優先する。起動時DB pingはNeon/Container Apps双方のcold startを考慮して最大約40秒retryする。
- Backend health、指標一覧、人口・出生数・完全失業率の詳細APIを同一Container Apps Environment内の手動Trigger Smoke Jobで確認する。配列が空でないこと、3 slugが存在すること、一覧と詳細の最新値がnullまたは空文字でないことも検証する。
- 成功後にFrontendをexternal ingress、port 3000、0.25 vCPU/0.5 GiB、min 0/max 2で作成/更新し、server-side `INTERNAL_API_URL`でBackend internal FQDNへ接続する。`NEXT_PUBLIC_SITE_URL`はStage 2のbuild argに加え、Stage 3で同じGitHub Environment Variableを実行時環境変数として設定する。Frontendの軽量な`/health`をStartup/Liveness/Readiness probeに使用する。ブラウザからBackendへ直接接続しない。
- BackendとFrontendは対象RevisionへTrafficを明示的に100%割り当てる。AzureからAppとRevisionをread-backし、名前、Ingress、port、digest URI、ACR server、Managed Identity、Secret reference、active Revision、Traffic合計100%と旧Revision 0%を検証する。Frontendはexternal、Backendはinternalでなければ失敗する。

WorkflowはSecret値を含むBackend仕様を権限`0600`の一時ディレクトリへ生成し、`az containerapp create/update --yaml`へ渡す。shellの`trap`で成功・失敗・signalを問わずディレクトリを削除し、Git、artifact、Terraform、Docker imageへ保存しない。Workflowログとjob summaryにも接続URLを出力しない。

Smoke JobはMigration imageを使用しない。ACRに存在するFrontend digest imageのNode.js runtimeを使い、internal Backend APIのJSONを検証する。JobのManaged Identityは対象ACRだけの`AcrPull`を持ち、Neon Secretを受け取らない。インラインNodeコードは`--args="--eval=$validation_code"`で単一argvとして渡す。`--args=-e "$validation_code"`や`--input-type=module`は使用せず、JavaScript全文をAzure CLIの独立引数にしない。分離するとJob createがARMへ到達する前にCLI解析で失敗する。Job作成に失敗するとBackendだけが残る場合があるが、Backendがinternal ingressであれば外部公開ではない。

Stage 3の必須Environment Variablesとして、Stage 1後に`AZURE_RESOURCE_GROUP`、`AZURE_CONTAINER_APP_ENVIRONMENT`、`AZURE_CONTAINER_APP_FRONTEND`、`AZURE_CONTAINER_APP_BACKEND`、`FRONTEND_IDENTITY_ID`、`BACKEND_IDENTITY_ID`をTerraform outputとAzure実値から登録する。Identity IDは文字列を組み立てず、`frontend_identity_id`と`backend_identity_id` outputまたは`az identity show --query id`を使う。

初回公開には旧正常Revisionがない。途中失敗時はContainer Apps、Revision、Ingress、Trafficを自動削除・自動rollbackせず、再実行もしない。`always()`の最終stepが残存App、公開状態、FQDN、latest Revision、Trafficをjob summaryへ記録し、人間が修正・削除・新しいレビュー後の再実行を判断する。Frontend external化後の失敗ではAzure HTTPS URLが到達可能な場合がある。

## Frontend画像最適化の暫定ガード

Next.js 15.5.22のstandalone成果物には`sharp 0.34.5`が含まれ、`GHSA-f88m-g3jw-g9cj`の影響範囲に該当する。KOKUSEIは`next/image`を使用しないが、未緩和のproduction containerではローカル画像を指定した`/_next/image`がHTTP 200となり、実行時に`sharp`がロードされることを確認した。

現在は`next.config.ts`の`images.unoptimized: true`でアプリから画像最適化を利用しないようにし、`middleware.ts`で外部からの`/_next/image`要求を入力内容にかかわらず固定404で拒否する。静的画像は通常の`/og-image.png`などから配信する。Stage 2前のguard testとproduction container試験では、`/health`、トップページ、静的画像が正常応答し、ローカルURL・外部URL・GIF・TIFFを含む画像最適化要求がすべて404となることを確認する。

この制限は、production container内の`sharp`が修正版（少なくとも`0.35.0`）へ更新され、対象Advisoryと`npm audit --omit=dev`を再確認し、同じ実コンテナ試験に合格するまで解除しない。将来`next/image`を導入する場合も、先にこの更新・再検証を行う。

## NEXT_PUBLIC_SITE_URL初回設定

Container Apps Environmentのdefault domainと固定app名から、Terraform `expected_frontend_url`が予定HTTPS FQDNを出力する。Stage 1 apply後にこの値を確認し、Azure Portal/CLIで想定nameとdomainを照合してGitHub Variableへ設定する。これにより仮Frontend app/imageを作らず正式buildできる。

初回だけWorkflowはFrontendをinternal ingressで作成し、実FQDNと`NEXT_PUBLIC_SITE_URL`が一致した後にexternalへ変更する。不一致ならinternalのまま失敗するため、localhost/仮URLを公開状態に残さない。URL変更時はVariable更新後に新commit SHAのFrontendを再build/deployする。

`NEXT_PUBLIC_SITE_URL`はビルド時と実行時の両方で必要である。動的metadata、sitemap、OGPはContainer App起動後に評価される経路があり、実行時設定がないと`http://localhost:3000`へフォールバックする可能性がある。WorkflowはFrontend Revisionから`INTERNAL_API_URL`と`NEXT_PUBLIC_SITE_URL`をread-backし、後者がGitHub Environment VariableのHTTPS URLと一致し、localhostを含まないことを確認する。公開Smokeではcanonical、`og:url`、`og:image`、Twitter image、sitemap、robotsを確認し、ページ表示の成功だけでは公開完了と判定しない。

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

設計上、Production Remote Stateはprivate Azure Blobを使用し、Neon URLとGitHub SecretはTerraform入力に存在しないためplan/stateへ入らない。Storage AccountはBlob lease lock、versioning、14日削除保持を有効にする。

Bootstrap StateとProduction Stateはprivate Azure Blobへ移行済みで、Azure AD認証とBlob lease lockを使用する。Production StateにはStage 1の15リソースが記録されている。今後もStateをpullして内容を表示したり、Shared Access Key、SAS、接続文字列へ切り替えたりしない。

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
