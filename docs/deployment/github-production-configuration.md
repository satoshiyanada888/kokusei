# GitHub Production Environment 設定・実行手順

この文書は、Azure Production Stage 1完了後にKOKUSEIをGitHub Actionsから初回公開するための設定表とguardをまとめる。実値、接続URL、password、tokenは記録しない。

## 3 Stageの責務

| Stage | 責務 | 開始条件 | 停止条件 | 再実行・rollback |
|---|---|---|---|---|
| 1: Azure基盤 | Resource Group、ACR、Log Analytics、Container Apps Environment、3 Managed Identities、限定RBAC、OIDC Federated Credential | operatorが対象Tenant・Subscription・Remote Stateとsaved planを確認 | planにdestroy/replace、想定外差分、権限・費用不明点がある | 同じsaved planだけをapplyする。失敗時はStateとAzure実体を再planし、推測で再applyしない |
| 2: image・DB準備 | SHA image build、Frontend/BackendをACRへpush、Migration、3公式import、個別・横断validation | Stage 1成功、GitHub設定完了、Required Reviewer承認、ACR SHA tag確認 | Migration、import、validationのいずれかが失敗 | MigrationとImporterは冪等。同一SHAで再実行できるが、失敗原因とNeon状態を先に確認する |
| 3: 公開 | internal Backend、内部Smoke Job、external Frontend、公開HTTPS/metadata確認 | Stage 2が同じworkflow runで成功 | Backend health/API、FQDN照合、Frontend smoke testのいずれかが失敗 | Container Apps Multiple revisionsで直前の正常revisionへtrafficを戻す。DBは自動rollbackしない |

Stage 2と3は`.github/workflows/deploy-production.yml`のjob依存と`set -euo pipefail`で直列化する。mainの手動実行以外はjob-level guardでskipし、production jobはEnvironment承認を通過するまでSecretとOIDC tokenへ到達しない。

## 値の分類

### GitHub `production` Environment Secrets

以下はすべて`.github/workflows/deploy-production.yml`のprotected `deploy` jobだけが参照する。

| 名前 | 用途 | 設定時期 | 参照箇所 | 未設定時 |
|---|---|---|---|---|
| `NEON_DATABASE_URL` | Backend roleのpooled TLS URL | Stage 1後、deploy前 | Stage 2 validation、Backend Container App Secret | guardで停止 |
| `NEON_MIGRATION_DATABASE_URL` | Migration roleのdirect TLS URL | Stage 1後、deploy前 | Migrationと公式Importer | guardで停止 |
| `ESTAT_APP_ID` | 出生数e-Stat取得 | Stage 1後、deploy前 | 出生数Importer | guardで停止 |

接続URLをRepository Secret、Variable、tfvars、backend.hcl、Terraform入力、issue、READMEへ保存しない。Neon owner URLは登録しない。登録画面へ貼り付ける前にSecret名とroleを再確認し、画面共有、shell history、clipboard manager、ログへ残さない。

### GitHub `production` Environment Variables

以下もすべて`.github/workflows/deploy-production.yml`のprotected `deploy` jobだけが参照する。

| 名前 | 用途 | 取得元 | 設定時期 | 未設定時 |
|---|---|---|---|---|
| `AZURE_CLIENT_ID` | OIDC対象Managed Identity | `github_actions_client_id` output | Stage 1後 | Azure login前guardで停止 |
| `AZURE_TENANT_ID` | Azure tenant | `az account show`でoperatorが確認 | Stage 1後 | guardで停止 |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | `az account show`でoperatorが確認 | Stage 1後 | guardで停止 |
| `AZURE_FEDERATED_SUBJECT` | GitHub発行OIDC subjectの完全一致検証 | `github_actions_federated_subject` output | Stage 1後 | Azure login前guardで停止 |
| `AZURE_RESOURCE_GROUP` | Production RG | `resource_group_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_REGISTRY` | ACR名 | `container_registry_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_APP_ENVIRONMENT` | Container Apps Environment名 | `container_app_environment_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_APP_FRONTEND` | Frontend app名 | `frontend_container_app_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_APP_BACKEND` | Backend app名 | `backend_container_app_name` output | Stage 1後 | guardで停止 |
| `FRONTEND_IDENTITY_ID` | Frontend ACR pull identity resource ID | `frontend_identity_id` output | Stage 1後 | guardで停止 |
| `BACKEND_IDENTITY_ID` | Backend ACR pull identity resource ID | `backend_identity_id` output | Stage 1後 | guardで停止 |
| `APP_DATABASE_USER` | 非特権Backend role名 | Neonで作成済みrole | deploy前 | Migration guardで停止 |
| `NEXT_PUBLIC_SITE_URL` | canonical/OGP/sitemap用HTTPS origin | `expected_frontend_url` output | Frontend初回build前 | guardで停止 |

これらは識別子・公開originでありpasswordではないためVariableとする。ただし、値を推測せずStage 1 outputと対象Azure accountから転記する。

### Terraform outputとRepository固定値

Stage 1後に取得するoutput:

```bash
cd infra/environments/production
terraform output
terraform output -raw github_actions_client_id
terraform output -raw github_actions_federated_subject
terraform output -raw resource_group_name
terraform output -raw container_registry_name
terraform output -raw container_app_environment_name
terraform output -raw frontend_container_app_name
terraform output -raw backend_container_app_name
terraform output -raw frontend_identity_id
terraform output -raw backend_identity_id
terraform output -raw expected_frontend_url
```

`location`、`container_registry_login_server`、`container_app_environment_id`、`stage_1_scope`も照合用outputであり、現行workflowへの登録は不要。Environment名`production`、GitHub repository `satoshiyanada888/kokusei`、OIDC issuer/audience、人口Importerの統計表ID・公表日はレビュー可能な非SecretとしてRepositoryに固定する。Azure regionはTerraform既定`japaneast`だが、実applyではoutputとtfvarsを正とする。

| Terraform output | 登録先 |
|---|---|
| `github_actions_client_id` | `AZURE_CLIENT_ID` |
| `github_actions_federated_subject` | `AZURE_FEDERATED_SUBJECT` |
| `resource_group_name` | `AZURE_RESOURCE_GROUP` |
| `container_registry_name` | `AZURE_CONTAINER_REGISTRY` |
| `container_app_environment_name` | `AZURE_CONTAINER_APP_ENVIRONMENT` |
| `frontend_container_app_name` | `AZURE_CONTAINER_APP_FRONTEND` |
| `backend_container_app_name` | `AZURE_CONTAINER_APP_BACKEND` |
| `frontend_identity_id` | `FRONTEND_IDENTITY_ID` |
| `backend_identity_id` | `BACKEND_IDENTITY_ID` |
| `expected_frontend_url` | `NEXT_PUBLIC_SITE_URL` |

| Repository固定値 | 用途 | 機密性 |
|---|---|---|
| `production` | GitHub Environment、OIDC context | 非機密 |
| `satoshiyanada888/kokusei` | OIDC repository制約 | 非機密 |
| `api://AzureADTokenExchange` | OIDC audience | 非機密 |
| e-Stat人口統計表ID・公表日 | 人口Importer対象 | 公開一次情報 |

## Stage 1 saved planと初回OIDCの循環

GitHub deploy identityとFederated CredentialはStage 1自身が作成する。このため、初回Stage 1をそのOIDC identityから実行することはできない。初回だけ、既に認証済みのoperatorがRemote Stateを使い、planとapplyを別操作として実行する。2026-07-21時点ではBootstrap Resource Groupが削除中でRemote Stateリソースが存在しないため、Bootstrapを別レビューで復旧し、private backendへの接続を確認するまで次のコマンドを実行しない。

Plan作成:

```bash
cd infra/environments/production
terraform init -backend-config=backend.hcl
terraform fmt -check -recursive ../../
terraform validate
terraform plan -out=production-stage1.tfplan
../../../scripts/production/check-stage1-plan.sh production-stage1.tfplan
terraform show -no-color production-stage1.tfplan
git rev-parse HEAD
```

別承認で、表示したcommitとsaved planが一致していること、`destroy=0`、`replace=0`を確認してからのみ実行する:

```bash
terraform apply production-stage1.tfplan
```

引数なしの`terraform apply`は、レビュー後に新しいplanを暗黙生成するため使用しない。`*.tfplan`、tfvars、backend.hcl、Stateは`.gitignore`対象で、artifactやGitHubへアップロードしない。Stage 1 apply時点でACR Basic、Log Analytics、Container Apps Environment等の課金対象が作成されるが、Container Appはまだ作成・公開されない。

## GitHub Environmentの手動設定

1. Repository `Settings > Environments > New environment`で`production`を作成する。
2. Required reviewersへ公開判断者を設定する。別のreviewerを用意できる場合は`Prevent self-review`を有効にする。設定可否を未確認のまま有効と扱わない。
3. Deployment branches and tagsを`Selected branches and tags`にし、`main`だけを許可する。
4. 利用可能ならEnvironment protection ruleのadministrator bypassを無効にする。
5. 上表のSecretsとVariablesをEnvironment単位で登録する。Repository/Organization Secretへ広げない。
6. Actions settingsでfork pull requestへSecretを送らない設定を維持する。workflowは`pull_request`と`workflow_call`を持たない。
7. `Actions > Deploy production > Run workflow`でbranch `main`を選び、confirmationへ正確に`DEPLOY`と入力する。
8. validate job成功後、Required Reviewerは対象commit SHAと今回の変更内容を確認してdeploy jobを承認する。

実行を中止する場合はEnvironment承認を拒否するか、待機中のrunをcancelする。deploy開始後のcancelは途中状態を残し得るため、ACR tag、Neon validation、Container App revisionを確認してから再実行する。concurrencyは`production-deployment`、`cancel-in-progress: false`なので別runが進行中runを中断しない。

## OIDCとAzure RBAC

- Identity: User Assigned Managed Identity `${name_prefix}-github-deploy`
- Issuer: `https://token.actions.githubusercontent.com`
- Audience: `api://AzureADTokenExchange`
- Subject: `repo:satoshiyanada888/kokusei:environment:production`
- GitHub permissions: deploy jobだけ`id-token: write`、全jobは`contents: read`
- Environmentとbranch: OIDC subjectはEnvironmentを限定し、GitHub job guardとdeployment branch ruleでmainを重ねて制限する

Repositoryは2026-07-15 03:15 UTC作成で、2026-07-21確認時点のOIDC customization APIは`use_default=true`、`use_immutable_subject=false`である。そのため、現行Terraformはlegacy Environment subjectを使用する。将来のopt-inやrepository移管でsubject形式が変わった場合に備え、deploy workflowはAzure login前にGitHubから実際のOIDC tokenを取得し、tokenをログへ出さず`github_actions_federated_subject`、issuer、audience、repository、environment、main ref、commit SHA、`workflow_ref`を完全一致検証する。不一致時はAzure login前に停止し、Federated Credentialを広く緩和せず、実claimに合わせたTerraform変更を別planでレビューする。

Azure role assignment:

| Role | Scope | 用途 |
|---|---|---|
| Container Apps Contributor | Production Resource Group | Container App/Job作成・更新 |
| AcrPush | 対象ACR | SHA image push |
| Managed Identity Operator | Frontend identity | Frontend Appへidentityを割当 |
| Managed Identity Operator | Backend identity | Backend App/Smoke Jobへidentityを割当 |

Subscription全体のContributor、Owner、User Access Administratorは付与しない。Frontend/Backend identityは対象ACRだけのAcrPullを持つ。Stage 1後、実Azureでscopeとprincipal IDがTerraform output/stateと一致することを確認する。

確認例（読み取り専用）:

```bash
az account show --query '{tenant:tenantId,subscription:id,name:name}' -o json
az identity show -g <resource-group> -n kokusei-prod-github-deploy --query '{clientId:clientId,principalId:principalId}' -o json
az identity federated-credential list -g <resource-group> --identity-name kokusei-prod-github-deploy -o json
az role assignment list --assignee <principal-id> --all -o table
```

値をチャット、issue、ログへ貼らず、subject、issuer、audience、scope、role名だけを照合する。

## 実行順・確認・rollback

1. Stage 1 saved planのadd/change/destroy/replace、commit SHA、料金対象を確認してapplyする。
2. outputをEnvironment Variablesへ登録し、Secrets、Required Reviewer、main ruleを設定する。
3. Azure OIDC Federated CredentialとRBAC scopeを読み取り確認する。
4. mainから手動workflowを開始する。validate jobはSecretなしでlint/test/build/guardを実行する。
5. Environment承認後、deploy jobがOIDC login、SHA image push、Stage 2、Stage 3を順番に実行する。
6. ACRにはFrontend/Backendの完全なcommit SHA tagが存在すること、Migration imageはRunner内だけであることを確認する。
7. Migration・公式データvalidation成功後だけBackendを作り、内部Smoke成功後だけFrontendをexternalにする。
8. HTTPS主要画面、canonical、OGP、sitemap、robotsを確認する。

Planでは、対象Subscription/RG、15 add、0 change、0 destroy、0 replace、Azure DB/VNet/Private DNS/Container Appsが含まれないことを確認する。件数が変わった場合は中止して再レビューする。

Frontend rollbackは直前の正常revisionへtrafficを100%戻す。Backendも同様に戻し、内部Smokeを再実行する。Migrationと公式データは自動rollbackしない。データ異常時は公開を進めず、Neon backup/branchとImporterの履歴判定を確認する。

Secret rotationでは、Neon側password変更後に対応するEnvironment Secretだけを更新する。Backend URL変更時はworkflowを再実行して新revisionのSecret参照とhealthを確認する。Migration URLと`ESTAT_APP_ID`は次回Stage 2で検証する。旧Secret値、URL userinfo、接続エラー全文をログへ出さない。

## 公式仕様

- [GitHub Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc)
- [Microsoft: Azure LoginをOIDCで利用する](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
