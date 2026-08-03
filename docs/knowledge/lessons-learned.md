# Lessons Learned

このファイルは開発中に得られた知見を蓄積する。

具体的な問題、原因、対応を記録し、一般化できる禁止事項や代替案は[Anti Patterns](anti-patterns.md)へ整理する。

## YYYY-MM-DD

### 内容

問題:

原因:

対応:

今後:

## 2026-07-31

### Immutable snapshotの公開順序

問題: 大きなJSONを同じblob名へ直接上書きすると、検証前または部分更新の内容を読ませる可能性がある。

原因: データ本体と「現在有効な版」の切替を同じwriteで扱うため。

対応: commit SHA固定のdatasetを先にupload・read-backし、SHA-256検証後に小さな`current.json`だけを更新する。

今後: snapshot型の配布ではimmutable bodyとmutable pointerを分離し、pointer更新を最後の操作にする。

## 2026-08-03

### Azure Resource IDのread-back比較

問題: Container App作成後のread-backで、同じManaged Identityを不一致と判定した。

原因: AzureがResource ID内の`resourceGroups`などを小文字へ正規化して返す場合があるが、文字列を大文字・小文字を区別して比較していた。

対応: Azure Resource IDだけをcase-insensitiveに正規化して比較し、表記差を許可しながら別Resource IDは拒否する回帰テストを追加した。

今後: Azure Resource IDの一致確認では大小文字を意味のある差として扱わず、正規化後の完全一致を使用する。
