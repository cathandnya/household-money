# household-money

銀行・クレジットカード・証券・DC・手動記録の各口座を一元管理する個人ローカル家計簿アプリ。CSV/PDF/HTML を取り込んで、資産推移・取引明細・ポートフォリオを可視化する。

## 対応機関

| 種別 | 機関 | 取り込み形式 |
|---|---|---|
| 銀行 | SBI 新生銀行 / 楽天銀行 / 三井住友信託銀行 (PDF) / ゆうちょ銀行 / りそな銀行 | 入出金明細 CSV / PDF |
| カード | 三井住友カード (Vpass) / 楽天カード | 利用明細 CSV |
| 証券 | 楽天証券 / 楽天証券ジュニアNISA | 取引履歴 CSV / 保有商品 CSV (時価評価額スナップショット) |
| DC | SBI ベネフィットシステムズ | 資産状況 HTML (スナップショット) |
| 手動入力 | 現金財布・電子マネー・ポイントなど CSV 配信のない口座 | UI から日付＋残高を直接入力 |

文字コード (Shift_JIS / UTF-8 / JIS) は自動判定。`fileHash` でファイル重複、`rowHash` で期間重複の行レベル重複を検出してスキップする。

## 機能

- 機関 → 口座 → アダプタ → CSV/PDF/HTML を Web UI に D&D してアップロード、プレビューで確認してからコミット
- CSV 配信のない口座向けの手動入力モード (日付＋残高だけで記録、資産推移に反映)
- 取引明細の検索 / フィルタ (機関・カテゴリ・期間) と手動カテゴリ補正
- 明細でカテゴリを変更したら、payee からパターン候補 (完全一致 / 末尾数字除去 / プレフィックス除去 / 括弧前 / 空白前) を自動生成し、ワンクリックでルール化 + 他の未分類明細にも一括適用
- カテゴリ自動分類ルール (部分一致 / 正規表現) と既存明細への一括再適用
- ポートフォリオ画面で銘柄を口座横断で集計、構成比表示
- ダッシュボードで資産推移グラフ・月次収支・カテゴリ集計、月セレクタで対象月切り替え
- 取り込み履歴ページ (`/history`) で過去の取込を一覧
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

1. `/accounts` で各機関の口座を登録（手動入力機関を選べば CSV 配信のない口座も作れる）
2. `/import` で CSV/PDF/HTML をアップロード（機関は自動判定、口座が1つなら自動選択）
3. プレビューを確認して「この内容で取り込む」
4. 手動入力口座は `/accounts` の行に出る「残高記録」リンクから日付＋残高を入力
5. `/transactions` で気になる明細のカテゴリを選ぶと、そのまま「ルール化」ダイアログが開いて候補から選択 → 他の未分類明細に一括適用
6. `/rules` で手動編集や `全件再適用` も可能
7. `/` (ダッシュボード) で資産推移と月次収支、`/portfolio` でポートフォリオ、`/transactions` で明細、`/history` で取込履歴を閲覧

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
