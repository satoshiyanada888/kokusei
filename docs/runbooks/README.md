# Runbooks

このディレクトリは、再現可能な運用手順を管理する。

## 対象

- Release
- Deploy
- Rollback
- Migration
- 障害対応

手順には前提条件、実行順序、成功条件、停止条件、ロールバック方法を記載する。Secret、password、token、実接続URLは記録しない。

既存の本番運用手順は次を参照する。

- [Azure Container Apps + Neon 初回公開手順](../deployment/azure-container-apps.md)
- [GitHub Production Environment 設定・実行手順](../deployment/github-production-configuration.md)

## Blob snapshot切替とrollback

1. Production Terraform planでapp-data Storage、private container、2つの限定RBACだけが
   追加され、destroy/replaceが0であることを別レビューする。
2. 承認済みsaved planだけをapplyし、Backend ReaderとGitHub Contributorの伝播を確認する。
3. Storage outputをGitHub `production` Variablesへ登録し、
   `PRODUCTION_SNAPSHOT_UPLOAD=true`で新commitのStage 2を手動実行する。
4. ArtifactとBlob read-backでcommit、SHA-256、schema、3指標の検証成功を確認する。
5. `PRODUCTION_DATA_STORE=blob`を設定し、同じcommitで新しいStage 2証跡を作ってStage 3を実行する。
6. Backend API、Frontend、canonical/OGP/sitemap/robotsとBlob障害時cacheを監視する。
7. 問題時はNeon Secretを残したまま`PRODUCTION_DATA_STORE=postgres`へ戻し、
   新しいStage 3 Revisionを作ってAPIとTrafficを再確認する。

Storage apply、Environment変更、Stage 2/3はそれぞれ独立した人間承認を必要とする。
Blob安定期間、rollback確認、Neon不要の判断が揃うまでNeon Projectを削除しない。
