# GitHub Production Environment 設定・実行手順

この文書は、Azure Production Stage 1完了後にKOKUSEIをGitHub Actionsから初回公開するための設定表とguardをまとめる。実値、接続URL、password、tokenは記録しない。

## 3 Stageの責務

| Stage | 責務 | 開始条件 | 停止条件 | 再実行・rollback |
|---|---|---|---|---|
| 1: Azure基盤 | Resource Group、ACR、Log Analytics、Container Apps Environment、3 Managed Identities、限定RBAC、OIDC Federated Credential | operatorが対象Tenant・Subscription・Remote Stateとsaved planを確認 | planにdestroy/replace、想定外差分、権限・費用不明点がある | 同じsaved planだけをapplyする。失敗時はStateとAzure実体を再planし、推測で再applyしない |
| 2: image・snapshot準備 | linux/amd64 SHA image build、Frontend/BackendをACRへpush、digest・manifest検証、3公式Provider取得、直前Blobとの差分履歴生成、snapshot upload/read-back | Stage 1成功、GitHub設定完了、Required Reviewer承認、対象SHA tagがACRに存在しない | build、push、Provider取得、snapshot検証、Blob read-backのいずれかが失敗 | 既存SHA tagは上書きせず停止する。`current.json`を変更せず原因を確認し、必要なら修正commitで再実行する |
| 3: 公開 | digest固定のinternal Backend、内部Smoke Job、digest固定のexternal Frontend、Revision/Ingress/Traffic read-back、公開HTTPS/metadata確認 | Stage 2 Run ID・artifact・summaryをレビューし、Run ID、commit SHA、2つのdigestを別の手動実行へ入力してRequired Reviewerが承認 | Stage 2証跡、digestとSHA tag、Backend health/API、read-back、FQDN、Frontend health/smoke testのいずれかが失敗 | 初回公開は自動削除・rollback・rerunせず残存状態を報告する。正常Revisionがある2回目以降だけ人間判断でtrafficを戻す |

Stage 2は`.github/workflows/prepare-production.yml`、Stage 3は`.github/workflows/deploy-production.yml`であり、それぞれ独立した`workflow_dispatch`だけを持つ。Stage 2はStage 3を起動せず、Container Apps操作も行わない。両Workflowともmain以外をjob-level guardでskipし、protected jobは`production` Environment承認を通過するまでSecretとOIDC tokenへ到達しない。

## 値の分類

### GitHub `production` Environment Secrets

以下は`production` Environmentで保護する。Stage 2の`prepare` jobだけが参照し、Stage 3はSecretを参照しない。

| 名前 | 用途 | 設定時期 | 参照箇所 | 未設定時 |
|---|---|---|---|---|
| `ESTAT_APP_ID` | 出生数e-Stat取得 | Stage 1後、deploy前 | Stage 2 snapshot生成 | guardで停止 |

API keyをRepository Secret、Variable、tfvars、backend.hcl、Terraform入力、issue、READMEへ保存しない。登録画面へ貼り付ける前にSecret名を再確認し、画面共有、shell history、clipboard manager、ログへ残さない。旧Neon Secretsは新Workflow成功後に別承認で削除する。

### GitHub `production` Environment Variables

以下も`production` Environment Variablesとして管理する。Stage 2はbuild・ACR・Blob snapshot準備に必要な項目だけを参照し、Stage 3はContainer Apps公開に必要な項目を参照する。

| 名前 | 用途 | 取得元 | 設定時期 | 未設定時 |
|---|---|---|---|---|
| `AZURE_CLIENT_ID` | OIDC対象Managed Identity | `github_actions_client_id` output | Stage 1後 | Azure login前guardで停止 |
| `AZURE_TENANT_ID` | Azure tenant | `az account show`でoperatorが確認 | Stage 1後 | guardで停止 |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | `az account show`でoperatorが確認 | Stage 1後 | guardで停止 |
| `AZURE_FEDERATED_SUBJECT` | GitHub発行OIDC subjectの完全一致検証 | `github_actions_federated_subject` output | Stage 1後 | Azure login前guardで停止 |
| `AZURE_RESOURCE_GROUP` | Production RG | `resource_group_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_REGISTRY` | ACR名 | `container_registry_name` output | Stage 1後 | guardで停止 |
| `ACR_LOGIN_SERVER` | ACR login server hostname | `container_registry_login_server` output | Stage 1後 | Azure login前guardで停止 |
| `AZURE_CONTAINER_APP_ENVIRONMENT` | Container Apps Environment名 | `container_app_environment_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_APP_FRONTEND` | Frontend app名 | `frontend_container_app_name` output | Stage 1後 | guardで停止 |
| `AZURE_CONTAINER_APP_BACKEND` | Backend app名 | `backend_container_app_name` output | Stage 1後 | guardで停止 |
| `FRONTEND_IDENTITY_ID` | Frontend ACR pull identity resource ID | `frontend_identity_id` output | Stage 1後 | guardで停止 |
| `BACKEND_IDENTITY_ID` | Backend ACR pull identity resource ID | `backend_identity_id` output | Stage 1後 | guardで停止 |
| `BACKEND_IDENTITY_CLIENT_ID` | Blob SDKが選択するBackend Managed Identity | `backend_identity_client_id` output | Blob切替前 | Blob mode guardで停止 |
| `NEXT_PUBLIC_SITE_URL` | canonical/OGP/sitemap用の利用者向けHTTPS origin | 初回は`expected_frontend_url` output、独自ドメイン移行後は検証済みの公開URL | Frontend build前 | guardで停止 |
| `PRODUCTION_SNAPSHOT_UPLOAD` | Stage 2 Blob upload（Productionは`true`必須） | Storage apply/read-back後に人間が設定 | deploy前 | `true`以外はguardで停止 |
| `PRODUCTION_DATA_STORE` | Backend repository（Productionは`blob`必須） | Blob証跡確認後に人間が設定 | deploy前 | `blob`以外はguardで停止 |
| `AZURE_STORAGE_ACCOUNT_NAME` | 公式snapshot用Storage Account | `app_data_storage_account_name` output | Blob Phase 2 | Blob mode guardで停止 |
| `AZURE_STORAGE_CONTAINER_NAME` | private snapshot container | `app_data_storage_container_name` output | Blob Phase 2 | Blob mode guardで停止 |
| `AZURE_STORAGE_CURRENT_BLOB` | atomic pointer blob | 固定値`current.json` | Blob Phase 2 | Blob mode guardで停止 |

これらは識別子・公開originでありpasswordではないためVariableとする。ただし、値を推測せずStage 1 outputと対象Azure accountから転記する。

Stage 3を初回実行する前に、少なくとも次の6件をStage 1 outputとAzure実値で照合してEnvironmentへ設定する。

```text
AZURE_RESOURCE_GROUP=rg-kokusei-prod
AZURE_CONTAINER_APP_ENVIRONMENT=kokusei-prod-env
AZURE_CONTAINER_APP_FRONTEND=kokusei-prod-frontend
AZURE_CONTAINER_APP_BACKEND=kokusei-prod-backend
FRONTEND_IDENTITY_ID=<terraform output -raw frontend_identity_id>
BACKEND_IDENTITY_ID=<terraform output -raw backend_identity_id>
```

Identity IDは手入力で組み立てない。Terraform outputと`az identity show -g rg-kokusei-prod -n <identity-name> --query id -o tsv`が一致することを確認してから登録する。

独自ドメインへ移行した後は、`expected_frontend_url`を`NEXT_PUBLIC_SITE_URL`へ再転記しない。Container Apps既定FQDNはリソースの同一性確認用に残し、`NEXT_PUBLIC_SITE_URL`には利用者向けのHTTPS origin（現在は`https://kokusei.yanada.tokyo`）を設定する。Environment Variableを変更する前に、DNS、FrontendのSNI custom domain binding、Managed Certificateの`Succeeded`を確認する。変更後は新しいcommit SHAでStage 2とStage 3を実行し、canonical、OGP、sitemap、robotsの公開Smokeを通す。

### Terraform outputとRepository固定値

Stage 1後に取得するoutput:

```bash
cd infra/environments/production
terraform output
terraform output -raw github_actions_client_id
terraform output -raw github_actions_federated_subject
terraform output -raw resource_group_name
terraform output -raw container_registry_name
terraform output -raw container_registry_login_server
terraform output -raw container_app_environment_name
terraform output -raw frontend_container_app_name
terraform output -raw backend_container_app_name
terraform output -raw frontend_identity_id
terraform output -raw backend_identity_id
terraform output -raw backend_identity_client_id
terraform output -raw app_data_storage_account_name
terraform output -raw app_data_storage_container_name
terraform output -raw app_data_storage_account_id
terraform output -raw expected_frontend_url
```

`location`、`container_app_environment_id`、`stage_1_scope`も照合用outputである。Environment名`production`、GitHub repository `satoshiyanada888/kokusei`、OIDC issuer/audience、人口Importerの統計表ID・公表日はレビュー可能な非SecretとしてRepositoryに固定する。Azure regionはTerraform既定`japaneast`だが、実applyではoutputとtfvarsを正とする。

| Terraform output | 登録先 |
|---|---|
| `github_actions_client_id` | `AZURE_CLIENT_ID` |
| `github_actions_federated_subject` | `AZURE_FEDERATED_SUBJECT` |
| `resource_group_name` | `AZURE_RESOURCE_GROUP` |
| `container_registry_name` | `AZURE_CONTAINER_REGISTRY` |
| `container_registry_login_server` | `ACR_LOGIN_SERVER` |
| `container_app_environment_name` | `AZURE_CONTAINER_APP_ENVIRONMENT` |
| `frontend_container_app_name` | `AZURE_CONTAINER_APP_FRONTEND` |
| `backend_container_app_name` | `AZURE_CONTAINER_APP_BACKEND` |
| `frontend_identity_id` | `FRONTEND_IDENTITY_ID` |
| `backend_identity_id` | `BACKEND_IDENTITY_ID` |
| `backend_identity_client_id` | `BACKEND_IDENTITY_CLIENT_ID` |
| `app_data_storage_account_name` | `AZURE_STORAGE_ACCOUNT_NAME` |
| `app_data_storage_container_name` | `AZURE_STORAGE_CONTAINER_NAME` |
| `expected_frontend_url` | `NEXT_PUBLIC_SITE_URL`（初回のContainer Apps既定FQDNだけ） |

| Repository固定値 | 用途 | 機密性 |
|---|---|---|
| `production` | GitHub Environment、OIDC context | 非機密 |
| `satoshiyanada888/kokusei` | OIDC repository制約 | 非機密 |
| `16567805` | OIDC subjectのGitHub owner ID | 非機密 |
| `1301151718` | OIDC subjectのGitHub repository ID | 非機密 |
| `api://AzureADTokenExchange` | OIDC audience | 非機密 |
| e-Stat人口統計表ID・公表日 | 人口Importer対象 | 公開一次情報 |

## Stage 1 saved planと初回OIDCの循環

GitHub deploy identityとFederated CredentialはStage 1自身が作成する。このため、初回Stage 1をそのOIDC identityから実行することはできない。初回だけ、既に認証済みのoperatorがRemote Stateを使い、planとapplyを別操作として実行する。Bootstrap Remote StateとProduction Stage 1は適用済みであり、以後のTerraform変更でもRemote Backend、State件数、saved planを別レビューする。

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
7. GitHub上の`main` HEADを確認して、事前レビュー済みcommitの40文字完全SHAを取得する。短縮SHAは使用しない。
8. `Actions > Prepare production (Stage 2) > Run workflow`でbranch `main`を選び、`expected_commit_sha`へ確認済み完全SHA、confirmationへ正確に`PREPARE`と入力する。dispatchされた`github.sha`と一致しなければvalidate jobがEnvironment承認前に停止する。
9. validate job成功後、Required Reviewerは対象commit SHAを再確認して`prepare` jobを承認する。事前レビューしたSHA以外は承認しない。
10. Stage 2成功後、Run IDと、そのrunに所属するartifactまたはjob summaryのcommit SHA、Frontend digest、Backend digest、platform、公式取得・snapshot生成・Validation・Blob read-back結果を一体として確認する。
11. `Actions > Publish production (Stage 3) > Run workflow`でbranch `main`を選び、確認済みのStage 2 Run ID、commit SHA、2つのdigestを入力し、confirmationへ正確に`PUBLISH`と入力する。
12. Stage 3のvalidate jobは、指定Runがattempt 1の`completed/success`であること、artifactがそのrunに一意に所属すること、metadataと全入力が完全一致すること、入力commitがStage 3の`github.sha`と一致することをEnvironment承認前に検証する。
13. Stage 3のRequired Reviewerはvalidate成功後、Run ID、commit、artifact、digestの組を再確認して`publish` jobを承認する。

証跡の組を確認する形式例:

```text
stage2_run_id=30509831983
commit_sha=66036f51233c62bb3b5c1a82966d89c4bd0f1494
frontend_image_digest=sha256:965dc2e952b81936aab406a1a488c72696ce6b1567c10c817b34979c8afb3db6
backend_image_digest=sha256:ee7fff9e1614bb298af7706d477e087cb72dcecd77f0bbd793de5448f6412aad
confirmation=PUBLISH
```

この例はStage 2 Run `30509831983`の証跡であり、Workflow guard修正commitをpushした後のStage 3には使用できない。Stage 3は`commit_sha == github.sha`を要求するため、新commitをレビューしてStage 2を1回実行し、その新しいRun ID、commit SHA、2つのdigestへすべて置き換える。古いartifactと新しいWorkflow SHAを混在させない。

実行を中止する場合はEnvironment承認を拒否するか、待機中のrunをcancelする。Stage 2完了後もStage 3は自動起動しない。protected job開始後のcancelはACR tag、Blob snapshot、Container App revisionなどの途中状態を残し得るため、実体を確認してから次の対応を判断する。両Workflowのconcurrencyは`production-deployment`、`cancel-in-progress: false`なので相互に並行実行せず、進行中runを中断しない。

## OIDCとAzure RBAC

- Identity: User Assigned Managed Identity `${name_prefix}-github-deploy`
- Issuer: `https://token.actions.githubusercontent.com`
- Audience: `api://AzureADTokenExchange`
- Subject: `repo:satoshiyanada888@16567805/kokusei@1301151718:environment:production`
- GitHub permissions: Stage 2の`prepare` jobとStage 3の`publish` jobだけ`id-token: write`、全jobは`contents: read`。Stage 3のvalidate jobだけ指定Runとartifact取得のため`actions: read`
- Environmentとbranch: OIDC subjectはEnvironmentを限定し、GitHub job guardとdeployment branch ruleでmainを重ねて制限する

GitHubのOIDC APIが返すsubject prefixは、owner loginの後ろにowner ID、repository名の後ろにrepository IDを付ける。ID付きsubjectはRepository移管や名称再利用に対して安定した識別子となり、末尾の`:environment:production`でRequired Reviewerに保護されたProduction Environmentへ限定する。Azure Federated CredentialとGitHub Environment Variable `AZURE_FEDERATED_SUBJECT`には、Terraform output `github_actions_federated_subject`の同じ完全値を設定し、wildcardやbranch-only subjectへ緩和しない。

subjectを変更するときは、Federated Credential以外に差分がないTerraform planを別途レビューし、GitHub OIDC claim検証で実tokenとの完全一致を確認する。deploy workflowはAzure login前にtoken本体をログへ出さず、subject、issuer、audience、repository、environment、main ref、commit SHA、`workflow_ref`を検証する。不一致時はAzure login前に停止し、trust範囲を広げず実claimに合わせてTerraformとEnvironment Variableを同時に更新する。

Azure role assignment:

| Role | Scope | 用途 |
|---|---|---|
| Container Apps Contributor | Production Resource Group | Container App作成・更新 |
| Container Apps Jobs Contributor | Production Resource Group | 内部Smoke Job作成・更新・実行・状態確認 |
| AcrPush | 対象ACR | SHA image push |
| Managed Identity Operator | Frontend identity | Frontend Appへidentityを割当 |
| Managed Identity Operator | Backend identity | Backend App/Smoke Jobへidentityを割当 |

Subscription全体のContributor、Owner、User Access Administratorは付与しない。Frontend/Backend identityは対象ACRだけのAcrPullを持つ。Stage 1後、実Azureでscopeとprincipal IDがTerraform output/stateと一致することを確認する。

`Container Apps Contributor`は`Microsoft.App/containerApps/*`を対象とし、`Microsoft.App/jobs/write`を含まない。Stage 3の内部Smoke Jobを作成・更新・開始して実行状態を確認するため、Job専用の`Container Apps Jobs Contributor`をProduction Resource Groupに限定して付与する。この組み込みロールにはJob削除権限も含まれるが、Workflowへ自動削除処理は追加しない。Stage 3はOIDCでこのidentityを使用し、Client Secretは使用しない。Smoke Job以外の権限へ広げるSubscription全体のContributorは使用しない。

GitHub deploy identityのACR権限は対象Registryの`AcrPush`だけとし、login server取得のためのReaderは追加しない。2026-07-30のStage 2では`az acr login`後の`az acr show`が管理プレーン参照権限不足で停止したため、Stage 2とStage 3は`az acr show`を使用しない。代わりにTerraform outputから転記した`AZURE_CONTAINER_REGISTRY`と`ACR_LOGIN_SERVER`をAzure login前に完全一致検証し、検証済みhostnameをtag、push、manifest platform確認、Container AppsのRegistry設定へ一貫して使用する。不一致時はACR pushまたはContainer Apps変更前に停止する。

ACR名またはlogin serverが変わる場合は、同じStage 1 outputから両Environment Variableを同時に更新し、再度Workflow guardと事前レビューを行う。Issueや運用手順で`ACR_NAME`と表記する場合も、このRepositoryでの正式なVariable名は`AZURE_CONTAINER_REGISTRY`である。

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
4. GitHub上のmain HEADを確認し、その40文字完全SHAを`expected_commit_sha`へ入力してStage 2を手動実行する。validate jobはSecretなしで入力SHAと`github.sha`の完全一致、lint/test/build/guardを確認する。
5. Stage 2のEnvironment承認後、prepare jobがOIDC login、linux/amd64 SHA image push、digest・manifest確認、直前Blob検証、公式Provider取得、snapshot生成・upload・read-backを実行して停止する。
6. artifactとjob summaryで、完全なcommit SHA、Frontend/Backend URI・digest、`linux/amd64`、公式取得・snapshot検証・Blob read-back成功を確認する。ACRには完全なSHA tagだけがあることも確認する。
7. Stage 3を別途手動実行し、確認済みStage 2 Run ID、commit SHAと2つのdigestを入力する。Environment承認前に指定runの成功、attempt 1、artifact所属、一意性、metadata、Stage 3 `github.sha`を再照合する。
8. Stage 3はACR上でdigestの存在、SHA tagとの対応、platformを再検証する。さらにContainer Apps既定FQDNと利用者向け公開originを分離して照合し、独自ドメイン利用時はSNI bindingとManaged Certificateの成功を確認してから、タグではなくdigestでBackendを作成する。
9. Backend内部Smoke成功後だけFrontendをexternalにし、Frontend health、HTTPS主要画面、canonical、OGP、sitemap、robotsを確認する。
10. BackendとFrontendの対象RevisionへTrafficを100%設定し、AppとRevisionをread-backしてdigest、Ingress、port、registry、Managed Identity、Secret reference、Traffic合計100%を確認する。

Planでは、対象Subscription/RG、15 add、0 change、0 destroy、0 replace、Azure DB/VNet/Private DNS/Container Appsが含まれないことを確認する。件数が変わった場合は中止して再レビューする。

初回公開には直前の正常Revisionがないため、自動削除、自動rollback、自動rerunを行わない。失敗時の最終stepは、存在するContainer Apps、外部公開状態、FQDN、latest Revision、Trafficをsummaryへ記録する。Frontend external化後のSmoke失敗ではURLが到達可能な場合があるため、人間が実状態を確認して修正・削除・新規レビュー後の再実行を判断する。

2回目以降のFrontend rollbackは直前の正常revisionへtrafficを100%戻す。Backendも同様に戻し、内部Smokeを再実行する。snapshot pointerは自動rollbackしない。データ異常時は公開を進めず、`current.json`、対象dataset、SHA-256、前回snapshotとの差分を確認する。

`ESTAT_APP_ID` rotationではEnvironment Secretだけを更新し、次回Stage 2で公式取得成功を確認する。旧Secret値をログへ出さない。

## 公式仕様

- [GitHub Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- [GitHub OpenID Connect reference](https://docs.github.com/en/actions/reference/security/oidc)
- [Microsoft: Azure LoginをOIDCで利用する](https://learn.microsoft.com/en-us/azure/developer/github/connect-from-azure-openid-connect)
