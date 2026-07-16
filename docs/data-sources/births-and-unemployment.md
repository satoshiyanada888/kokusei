# 出生数・完全失業率の公式データ

2026-07-16に一次情報、分類、代表値、取得ファイルを確認した。本番Importerはここに記載した系列だけを許可し、公式host、dataset ID、分類、単位、期間、代表値、checksumのいずれかが変わった場合は停止する。

## 出生数

| 項目 | 採用内容 |
| --- | --- |
| 提供機関 | 厚生労働省 |
| 統計 | 人口動態調査・人口動態統計・確定数・出生 |
| 表 | 上巻 表4-3「都道府県別にみた年次別出生数・出生率（人口千対）」 |
| e-Stat DB ID | `0003411597` |
| 系列 | 表章項目`10040`出生数、地域`00000`全国、年次、単位「人」 |
| 採用期間 | 2015–2024年 |
| 一次情報 | [e-Stat DB](https://www.e-stat.go.jp/stat-search/database?layout=datalist&statdisp_id=0003411597) |
| 取得方式 | e-Stat API v3 `getStatsData`（API key必須） |
| 公開/更新 | 公開2026-03-17、更新2026-04-15 |

全国の確定出生数を採用する。1955年以降は表の注記上「子の住所地」による。概数、速報、出生率、都道府県値は混在させない。2024年の代表値は686,173人（DB値68.6173万人）で、e-Stat表4-3および総務省統計局「日本の統計2026」で照合した。

API responseは結果生成日時が毎回変わるためraw JSON全体ではなく、`tab/area/time/unit/value`を期間順に正規化したcanonical SHA-256を検証する。

```text
b21763cf39f1274b7d3079680132f0390bf79e83a6697fd0b6338e4e5c567d3f
```

Importerは「人」を10,000で割り、浮動小数点を使わず10進文字列として「万人」へ変換する。カンマ、注釈、欠損記号、負数、0、8桁超、重複年、2015年より前の値を本番系列へ入れない。

## 完全失業率

| 項目 | 採用内容 |
| --- | --- |
| 提供機関 | 総務省統計局 |
| 統計 | 労働力調査（基本集計）長期時系列データ |
| 表 | 長期時系列表2-1「主要項目」 |
| e-Stat file ID | `000001082681` |
| 系列 | 全国、年平均、男女計、完全失業率、単位`%` |
| 採用期間 | 2015–2025年 |
| 一次情報 | [e-Stat公式Excel](https://www.e-stat.go.jp/stat-search/files?layout=dataset&stat_infid=000001082681&toukei=00200531) |
| 取得方式 | e-Stat公式Excel（API key不要） |
| 公開日 | 2026-01-30 |

長期時系列表の「年次」「男女計」「完全失業率（%）」だけを採用する。月次の季節調整値、月次原数値、四半期、地域別、男女別、年齢別、旧基準の既公表値sheetは採用しない。完全失業率は公式定義上、労働力人口に占める完全失業者の割合である。

2025年の代表値は2.5%。2026-07-16に取得した`unemployment-2-1.xlsx`のSHA-256は次のとおり。

```text
7ee865692c8882a8452c5d36f5c5111cb2f75ebee9d972205ebd4941eb5afdab
```

Excelが更新された場合はchecksum不一致で停止する。新ファイルの表題、sheet、採用系列、最新値、注記を一次情報と再照合し、コードと本書のchecksum・代表値・公開日を同じchangeで更新する。労働力調査は国勢調査基準の切替え等により過去値が改訂されるため、同じperiodの変更はrepositoryがupdateし、`update_histories`へ記録する。

## 正規化と保存

| indicator | period | DB unit | value type | estimate kind |
| --- | --- | --- | --- | --- |
| `births` | `YYYY年` | 万人 | 10進文字列、最大4小数 | `final` |
| `unemployment-rate` | `YYYY年` | % | 10進文字列、0–1小数 | `final` |

両Importerとも`data_origin='official'`、一次情報URL、公開/更新日、取得日時、dataset IDを含む`external_id`を保存する。取得ログにはdataset ID、論理ファイル名、checksum、対象期間数、取得日時、`IMPORTER_VERSION`（本番ではGit commit SHA）を記録し、API keyやDB passwordは記録しない。

repositoryはindicator単位のtransaction advisory lockを取得し、全期間を1 transactionでupsertする。同一period・同一値は変更なし、改訂値だけupdateとhistory追加、途中失敗はrollbackとなる。本番テーブルを空にしない。

## 実行方法

ローカルでは`.env`の`ESTAT_APP_ID`を利用する。値をログやshell historyへ表示しない。

```bash
docker compose up -d database
docker compose run --rm backend /import-births
docker compose run --rm backend /import-unemployment
```

本番では`.github/workflows/prepare-production.yml`をRequired Reviewer承認後に手動実行する。Migration、出生数import/validation、完全失業率import/validation、人口import/validation、横断validationの順で実行する。開発seed、fixture、mock/sample環境変数はWorkflowから拒否される。

Validationの直接実行例:

```bash
kokusei-validate-production-data births
kokusei-validate-production-data unemployment-rate
kokusei-validate-production-data population
kokusei-validate-production-data all
```

失敗時はStage 3を開始しない。既存公式値は削除・全置換されないため、取得失敗時の復旧は原因を修正して同じSHA image/新しいreview済みimageでJobを再実行する。checksum変更時は自動で受け入れず、一次情報レビューを行う。

元データをGitへは保存しない。e-Statから同じdataset/file IDで再取得でき、Importer logのchecksumと照合できる。将来監査要件が高まった場合は、private Azure Blobにraw JSON/Excelとmetadata manifestをimmutable保存するIssueへ分離する。
