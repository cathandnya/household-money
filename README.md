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
cp .env.example .env    # 必要なら値を編集 (PORT・HOSTNAME・DATABASE_URL 等)
npm run setup
```

`npm run setup` は依存インストール → `data/money.db` 作成 (既存マイグレーション適用) → 機関マスタと初期カテゴリ投入をまとめて実行する。

## 設定

すべての設定は [.env](.env) (gitignore 済) に集約されている。サンプルは [.env.example](.env.example) を参照。

| 変数 | デフォルト | 用途 |
|---|---|---|
| `DATABASE_URL` | `file:../data/money.db` | SQLite ファイルのパス (`file:` 必須、prisma 配下からの相対) |
| `PORT` | `3001` | Next.js が listen するポート |
| `HOSTNAME` | `0.0.0.0` | listen するインターフェース。`127.0.0.1` でローカルのみに限定 |
| `ALLOWED_DEV_ORIGINS` | (未設定) | LAN 上の別ホスト名でアクセスするとき (カンマ区切り) |

## 起動方法

listen ポートとホスト名は `.env` の `PORT` / `HOSTNAME` で制御する (デフォルト `0.0.0.0:3001`)。

### 開発モード (Turbopack + HMR)

```bash
npm run dev
```

ファイル編集を即反映、エラーは画面と `console` に詳細表示。アダプタや UI を弄るときに使う。

### 本番モード (常用向け、軽量・高速)

```bash
npm run build  # ビルド (一度だけ)
npm run start
```

実運用は本番モードを推奨。HMR や型チェックのオーバーヘッドがなく、メモリも軽い。

### LAN 上の別ホスト名でアクセスする場合

`localhost` 以外のホスト名 (例: `myhost.local`) で開くと Next.js のクロスオリジン保護で HMR がブロックされる。`.env` の `ALLOWED_DEV_ORIGINS` にホスト名をカンマ区切りで追加すれば許可される ([next.config.ts](next.config.ts) で `allowedDevOrigins` に渡している)。

## 常駐させる (オプション)

ターミナルを閉じても起動し続けるよう、OS のサービスマネージャに登録する。

### macOS (launchd)

`~/Library/LaunchAgents/local.household-money.plist` を作成:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>local.household-money</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/npm</string>
    <string>run</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>/Users/yourname/path/to/household-money</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key>
  <string>/tmp/household-money.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/household-money.err</string>
</dict>
</plist>
```

`npm` のパスは `which npm` で確認 (Homebrew なら `/opt/homebrew/bin/npm` のことが多い)。読み込み:

```bash
launchctl load ~/Library/LaunchAgents/local.household-money.plist     # 起動
launchctl unload ~/Library/LaunchAgents/local.household-money.plist   # 停止
```

事前に `npm run build` を済ませておくこと。

### Linux (systemd, ユーザーサービス)

`~/.config/systemd/user/household-money.service` を作成:

```ini
[Unit]
Description=household-money
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/path/to/household-money
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

`npm` のパスは `which npm` で確認。有効化:

```bash
systemctl --user daemon-reload
systemctl --user enable --now household-money    # 起動 + 自動起動
systemctl --user status household-money          # 状態確認
journalctl --user -u household-money -f          # ログ追跡
systemctl --user disable --now household-money   # 停止 + 自動起動解除
```

OS 起動時に開始したい場合は `loginctl enable-linger $USER` も実行する。事前に `npm run build` を済ませておくこと。

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

## 免責事項

本ソフトウェアは作者の個人利用を目的とした実験的なものであり、**無保証** で提供されます。
取引明細・残高・資産推移などの集計値が実際の金融機関の記録と一致することを保証しません。
本ソフトウェアの使用によって生じたいかなる損害についても、作者は一切の責任を負いません。
税務申告・確定申告・財産証明など、正確性が要求される用途には使用しないでください。

CSV/PDF/HTML パーサーは特定の機関のフォーマット例に基づいて実装されており、
将来フォーマットが変更された場合や、想定外のレイアウトのファイルが入力された場合に、
誤った値で取り込まれる可能性があります。取り込み後は必ず明細画面で検算してください。

### セキュリティに関する注意 (重要)

本アプリには **認証・認可・暗号化などのセキュリティ機構が一切実装されていません**。
DB (`data/money.db`) は SQLite ファイルとして平文で保存され、
WEB UI も任意の閲覧者が全データを参照・編集できます。
インターネットや LAN 経由で他者からアクセスできる環境にホストすると、
銀行・カード・証券口座の取引明細・残高・資産推移が全て外部に漏洩します。

必ず以下の条件下でのみ使用してください:

- ローカル環境 (`localhost`) または信頼できる単独ユーザーの LAN 内でのみ起動する
- DB ファイルのバックアップを共有ストレージに置く場合は別途暗号化する
- リバースプロキシや認証付きトンネル (Tailscale, Cloudflare Access, ssh ポートフォワード等) で
  保護せずに公開しない
- マルチユーザーでの利用は想定していない (口座/明細/ルールはアプリ全体で共有)

## ライセンス

[MIT](LICENSE)
