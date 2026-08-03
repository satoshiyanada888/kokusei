# Use Azure Blob Storage for official indicator snapshots

## 日付

2026-07-31

## 状態

承認（Phase 1実装。Production切替は未承認）

## 背景

Production BackendはNeon PostgreSQLからread-onlyの公式統計を提供している。更新は
Stage 2に限定され、利用者リクエスト中の書込みはない。公開APIを変えず、更新単位を
レビュー可能なimmutable artifactへ寄せ、DB接続への依存を段階的に減らす必要がある。

## 決定内容

Stage 2が公式Providerの正規化済み値から自己完結JSONを生成し、
`snapshots/<commit-sha>/dataset.json`へ保存する。read-backとSHA-256検証後だけ
`current.json`を更新する。Backendは既存Repository interfaceのBlob実装をManaged
Identityで使用する。Phase 1では`DATA_STORE=postgres`を既定とし、Neon、Migration、
Secret、fallbackを削除しない。

## 理由

immutable datasetと小さなpointerを分離すると、部分更新を公開せず、commitとdigestで
Stage 2証跡を固定できる。Repository境界を維持すればFrontendとAPI契約を変更せずに
段階移行とrollbackができる。

## メリット

- 公式データの公開版をcommit SHAとSHA-256で一意に確認できる。
- Backendはprivate BlobをManaged Identityで読み、keyやSASを持たない。
- Neonを残したまま設定単位で切替・rollbackできる。

## デメリット

- Phase 1中はNeonとBlobの二重経路を保守する。
- `current.json`確認とcache更新、Stage 2 uploadの運用が増える。
- GitHub-hosted runnerのためStorage public network endpointを暫定利用する。

## 今後の影響

Phase 2はStorage/RBAC apply、最初のsnapshot read-back、Environment Variable変更、
Blob mode Stage 3、API/Frontend/SEO Smoke、監視、rollback確認の順で行う。Neon削除は
この証拠と別の人間判断を得た後に限る。
