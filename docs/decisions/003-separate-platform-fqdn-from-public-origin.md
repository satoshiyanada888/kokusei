# Container Apps既定FQDNと公開originを分離する

## 日付

2026-08-05

## 状態

承認

## 背景

FrontendはAzure Container Appsの既定FQDNで初回公開した後、利用者向けの独自ドメインを追加した。従来のProduction Workflowは`NEXT_PUBLIC_SITE_URL`が既定FQDNと一致することを要求していたため、Azureリソースの識別子とcanonical、OGP、sitemap、robotsに使う公開originを分離できなかった。

また、Frontendを`az containerapp update --yaml`で更新するときに既存のcustom domain bindingを仕様へ含めなければ、独自ドメインや証明書設定を意図せず失う可能性がある。

## 決定内容

- Container Apps Environmentのdefault domainから導出するFrontend既定FQDNを、Azureリソースの同一性とread-back確認に使う。
- `NEXT_PUBLIC_SITE_URL`を、利用者向け公開originとSEO URLの正とする。
- 公開originが既定FQDNと異なる場合、Stage 3はContainer Apps変更前に既存FrontendのSNI custom domain bindingとManaged Certificateの`Succeeded`を確認する。
- Frontend更新仕様へ既存の`customDomains`を引き継ぎ、更新後もhostname、binding type、certificate参照をread-backする。
- 独自ドメインのDNSと証明書を準備してからEnvironment Variableを変更し、新しいcommit SHAでStage 2とStage 3を実行する。

## 理由

既定FQDNと公開originは用途が異なる。両者を分離すれば、Container App自体の取り違えを防ぎながら、canonicalなどを信頼性のある独自ドメインへ移行できる。既存bindingの検証と保持をWorkflowへ入れることで、通常のRevision更新が独自ドメイン設定を壊す危険も抑えられる。

## メリット

- 独自ドメインをcanonical、OGP、sitemap、robotsへ一貫して使用できる。
- Azure既定FQDNを残してContainer AppとEnvironmentの対応を検証できる。
- 証明書未発行やbinding不整合を本番Revision更新前に検出できる。
- Frontend更新時のcustom domain消失を防止できる。

## デメリット

- DNS、custom domain binding、Managed Certificateの初回作成はTerraform State外の運用として残る。
- Stage 3の事前確認とread-backが増える。
- 独自ドメイン変更時はEnvironment Variable更新と新しいStage 2／Stage 3が必要になる。

## 今後の影響

当面はDNSとManaged Certificateの実状態をWorkflowがread-onlyで検証する。複数サービスのサブドメイン管理が増えた場合は、DNS zone、custom domain binding、certificateをTerraformへ移す範囲とimport手順を別ADRで判断する。それまでは手動作成済みbindingをWorkflowが保持し、Terraform管理済みであると誤って報告しない。
