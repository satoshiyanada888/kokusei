# Coding Rules

## 全般

- 既存アーキテクチャを尊重する
- 最小変更を優先する
- 不要なリファクタリングをしない
- コメントより読みやすいコードを書く

## Go

- handlerへビジネスロジックを書かない
- service層へ寄せる
- repositoryはDBアクセスのみ
- errorは適切にwrapする
- panicは禁止

## Terraform

- 保存済みplan以外でapplyしない
- plan結果を必ず確認する
- Resource置換は理由を確認する

## GitHub Actions

- 変更範囲に対応するCIまたは同等のローカル検証が通ることを完了条件とする
- Secretはログへ出さない
