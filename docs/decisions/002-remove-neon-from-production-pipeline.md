# Remove Neon from the production data pipeline

## 日付

2026-08-04

## 状態

承認待ち（実装・検証後にProduction Workflow反映を別承認する）

## 背景

本番BackendはAzure Blob Storageの公式JSON snapshotだけを参照している。一方、
Stage 2は更新履歴を得るためだけにNeon PostgreSQLへMigration・Import・Validationを
行っており、固定費、Secret、role、外部依存を残していた。

## 決定内容

Production Stage 2は公的Providerから新しいsnapshotを生成し、`current.json`が指す
直前の検証済みsnapshotと比較する。同一指標・同一期間の数値変更だけを更新履歴へ
追加し、新規期間は履歴化しない。以前存在した期間が欠落する場合は公開を停止する。
Stage 3は`DATA_STORE=blob`だけを許可し、Neon Secretと`DATABASE_URL`を渡さない。

## 理由

公開データの正本と履歴判定元を同じimmutable snapshot系列へ統一すれば、Neonを
Productionの可用性・コスト・Secret管理から外しつつ、既存APIを維持できる。

## メリット

- ProductionのDB固定費、DB Secret、Migration roleが不要になる。
- commit SHA、dataset SHA-256、前後snapshotから履歴判定を再現できる。
- BackendとStage 2が同じ公開データ系列を検証する。

## デメリット

- `current.json`または直前snapshotを取得できないとStage 2は停止する。
- Providerが以前の期間を返さなくなった場合、意図的な確認なしには公開できない。
- PostgreSQL経路はローカル開発用として残るため、両repositoryのAPI互換性確認は必要。

## 今後の影響

Workflow変更commitでStage 2を新規実行し、Blob差分履歴、artifact、digestを確認してから
Stage 3を実行する。成功後に未使用のNeon Environment SecretsとNeon Projectを、
別の人間承認で削除する。`kokusei_Image.png`のStage 2図もNeon-free構成へ更新した。
