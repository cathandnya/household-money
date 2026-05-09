# household-money

銀行・クレジットカード・証券口座の明細 CSV を取り込んで、資産推移・取引明細・ポートフォリオを一元管理する個人ローカル家計簿アプリ。

## 対応機関

| 種別 | 機関 | 取り込み形式 |
|---|---|---|
| 銀行 | SBI 新生銀行 / 楽天銀行 / 三井住友信託銀行 / ゆうちょ銀行 | 入出金明細 CSV |
| カード | 三井住友カード (Vpass) / 楽天カード | 利用明細 CSV |
| 証券 | 楽天証券 | 取引履歴 CSV / 保有商品 CSV (時価評価額スナップショット) |
| DC | SBI ベネフィットシステムズ | 残高スナップショット CSV |

文字コード (Shift_JIS / UTF-8 / JIS) は自動判定。`fileHash` でファイル重複、`rowHash` で期間重複の行レベル重複を検出してスキップする。

## 機能

- 機関 → 口座 → アダプタ → CSV を Web UI に D&D してアップロード、プレビューで確認してからコミット
- 取引明細の検索 / フィルタ (機関・カテゴリ・期間) と手動カテゴリ補正
- カテゴリ自動分類ルール (部分一致 / 正規表現) と既存明細への一括再適用
- ポートフォリオ画面で銘柄を口座横断で集計、構成比表示
- ダッシュボードで資産推移グラフと月次カテゴリ集計
- ライト / ダークモード両対応

## 技術スタック

- Next.js 16 (App Router) + React 19
- Prisma 7 + better-sqlite3 (SQLite ファイル 1 個)
- Tailwind CSS v4
- recharts / papaparse / iconv-lite

## セットアップ

```bash
npm install
npx prisma migrate dev   # data/money.db を作成しマイグレーションを適用
npx tsx prisma/seed.ts   # 機関マスタ・初期カテゴリ投入
npm run dev              # http://localhost:3001
```

`.env` の `DATABASE_URL` は `file:../data/money.db` を指す。

### LAN 上の別ホスト名でアクセスする場合

`localhost` 以外のホスト名 (例: `pino.local`) で開くと Next.js のクロスオリジン保護で HMR がブロックされ、ハイドレーションが進まない。許可ホストを `.env.local` で設定する:

```
ALLOWED_DEV_ORIGINS=pino.local,othermachine.local
```

[next.config.ts](next.config.ts) がこの環境変数を読んで `allowedDevOrigins` に渡す。`.env.local` は gitignore 対象なのでホストごとに各自で用意する。

## 使い方

1. `/accounts` で各機関の口座を登録
2. `/import` で機関 → 口座 → CSV フォーマットを選び CSV をアップロード
3. プレビューを確認して「この内容で取り込む」
4. `/rules` で「スターバックス → 外食」のような自動分類ルールを追加し、必要なら全件再適用
5. `/` (ダッシュボード) で資産推移と月次カテゴリ、`/portfolio` でポートフォリオ、`/transactions` で明細を閲覧

## ディレクトリ構成

```
prisma/             schema, migrations, seed
src/app/            App Router の各ページと API ルート
src/lib/parsers/    機関別 CSV アダプタと共通ユーティリティ
src/lib/aggregate.ts  集計クエリ
src/lib/categorize.ts ルールベースのカテゴリ自動分類
data/               SQLite の DB ファイル (gitignore)
tests/parsers/fixtures/  動作確認用サンプル CSV
```

## ライセンス

Private / Personal use.
