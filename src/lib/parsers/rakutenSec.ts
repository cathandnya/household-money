import Papa from "papaparse";
import type {
  ParsedHoldingRow,
  ParsedSecTxRow,
  TextParserAdapter,
  ParseResult,
} from "./types";
import { parseAmount, parseFloatJp, parseJpDate } from "./util";

// --- 楽天証券 取引履歴 CSV ---
// ヘッダ例: 約定日,銘柄コード,銘柄名,市場,取引区分,数量,単価,受渡金額,手数料,税
export const rakutenSecTxAdapter: TextParserAdapter = {
  format: "text",
  code: "rakuten_sec_tx",
  institutionCode: "rakuten_sec",
  label: "楽天証券 取引履歴",
  encoding: "auto",
  resultKind: "sec_tx",
  detect(text: string): number {
    const head = text.slice(0, 500);
    if (/■/.test(head)) return 0; // 楽天証券のレポート CSV は別アダプタ
    if (/(約定日|受渡日)/.test(head) && /銘柄/.test(head) && /(受渡金額|手数料)/.test(head)) return 0.9;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "sec_tx", rows: [], warnings: ["empty"] };

    const headerIdx = rows.findIndex(
      (r) => r.some((c) => /約定日|受渡日/.test(c)) && r.some((c) => /銘柄/.test(c)),
    );
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/約定日|受渡日/);
    const iCode = idx(/銘柄コード|コード/);
    const iName = idx(/銘柄名|銘柄/);
    const iSide = idx(/取引区分|区分|売買/);
    const iQty = idx(/数量|株数|口数/);
    const iPrice = idx(/単価|約定価格/);
    const iAmount = idx(/受渡金額|金額/);
    const iFee = idx(/手数料/);
    if (iDate < 0 || iName < 0) {
      return { kind: "sec_tx", rows: [], warnings: ["必須列なし"] };
    }

    const out: ParsedSecTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const sideRaw = (iSide >= 0 ? r[iSide] : "").trim();
      const side: ParsedSecTxRow["side"] = /買/.test(sideRaw)
        ? "BUY"
        : /売/.test(sideRaw)
          ? "SELL"
          : /配当|分配/.test(sideRaw)
            ? "DIVIDEND"
            : /入金/.test(sideRaw)
              ? "DEPOSIT"
              : /出金/.test(sideRaw)
                ? "WITHDRAW"
                : "OTHER";
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({
        tradedAt: date,
        ticker: iCode >= 0 ? r[iCode]?.trim() : undefined,
        name: (r[iName] ?? "").trim(),
        side,
        qty: iQty >= 0 ? parseFloatJp(r[iQty]) : undefined,
        price: iPrice >= 0 ? parseFloatJp(r[iPrice]) : undefined,
        amount: iAmount >= 0 ? parseAmount(r[iAmount]) : 0,
        fee: iFee >= 0 ? parseAmount(r[iFee]) : undefined,
        raw,
      });
    }
    return { kind: "sec_tx", rows: out, warnings };
  },
};

// --- 楽天証券 保有商品スナップショット ---
// 楽天証券のポートフォリオ画面からダウンロードできるレポート CSV は
//   ・「■資産合計欄」「■保有商品詳細」「■参考為替レート」など複数セクションが
//     1ファイルに混在し、各セクション間は空行や見出し行で区切られる。
// ここでは「保有商品詳細」セクションのテーブルだけを抽出する。
//   テーブルヘッダ例:
//     種別,銘柄コード・ティッカー,銘柄,口座,保有数量,［単位］,平均取得価額,
//     ［単位］,現在値,［単位］,現在値(更新日),(参考為替),前日比,［単位］,
//     時価評価額[円],時価評価額[外貨],評価損益[円],評価損益[％]
export const rakutenSecHoldingAdapter: TextParserAdapter = {
  format: "text",
  code: "rakuten_sec_holding",
  institutionCode: "rakuten_sec",
  label: "楽天証券 保有商品 (スナップショット)",
  encoding: "auto",
  resultKind: "snapshot",
  detect(text: string): number {
    const head = text.slice(0, 1000);
    if (/■資産合計欄/.test(head) || /■\s*保有商品詳細/.test(head)) return 1;
    return 0;
  },
  parse(text: string, fileName: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: false });
    const rows = parsed.data as string[][];
    if (rows.length === 0)
      return {
        kind: "snapshot",
        snapshot: { snapshotDate: new Date(), holdings: [] },
        warnings: ["empty"],
      };

    // ファイル名から日付を抽出 (YYYYMMDD or YYYY-MM-DD)
    let snapshotDate = new Date();
    const m = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (m) snapshotDate = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else {
      snapshotDate.setUTCHours(0, 0, 0, 0);
      warnings.push("ファイル名から日付を抽出できなかったため本日を採用");
    }

    // 「■ 保有商品詳細」セクションを探す → 直後のヘッダ行 → 次の空行 or 「■」までを取り出す
    const sectionStart = rows.findIndex((r) => /保有商品詳細/.test(r[0] ?? ""));
    if (sectionStart < 0) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate, holdings: [] },
        warnings: ["「保有商品詳細」セクションが見つかりません"],
      };
    }
    // セクション開始以降で「銘柄」を含むヘッダ行を探す
    const headerIdx = rows
      .slice(sectionStart + 1)
      .findIndex((r) => r.some((c) => /銘柄/.test(c)) && r.some((c) => /時価評価/.test(c)));
    if (headerIdx < 0) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate, holdings: [] },
        warnings: ["保有商品詳細のヘッダ行が見つかりません"],
      };
    }
    const absHeaderIdx = sectionStart + 1 + headerIdx;
    const header = rows[absHeaderIdx].map((s) => s.trim());
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iCode = idx(/コード|ティッカー/);
    // 「銘柄コード・ティッカー」と単独の「銘柄」を区別する: コード列を除外して銘柄名列を探す
    const iName = header.findIndex(
      (h, i) => i !== iCode && /^銘柄$|銘柄名/.test(h),
    );
    const iAccount = idx(/口座/);
    const iQty = idx(/保有数量|数量|株数|口数/);
    const iAvg = idx(/平均取得|取得単価/);
    const iValueJpy = header.findIndex((h) => /時価評価額\[円\]/.test(h));

    const holdings: ParsedHoldingRow[] = [];
    for (let i = absHeaderIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c?.trim())) break; // 空行でセクション終了
      if ((r[0] ?? "").startsWith("■")) break; // 次セクションで終了
      const name = iName >= 0 ? (r[iName] ?? "").trim() : "";
      if (!name) continue;
      const acc = iAccount >= 0 ? (r[iAccount] ?? "").trim() : "";
      holdings.push({
        ticker: iCode >= 0 ? r[iCode]?.trim() || undefined : undefined,
        name: acc ? `${name} (${acc})` : name,
        qty: iQty >= 0 ? parseFloatJp(r[iQty]) ?? 0 : 0,
        avgCost: iAvg >= 0 ? parseFloatJp(r[iAvg]) : undefined,
        marketValue: iValueJpy >= 0 ? parseAmount(r[iValueJpy]) : 0,
      });
    }
    return { kind: "snapshot", snapshot: { snapshotDate, holdings }, warnings };
  },
};

// --- 楽天証券 ジュニアNISA / NISA 投信保有 CSV ---
// ヘッダ例:
//   投資信託種別, 口座区分, ファンド, 分配金コース, 保有数量[口],
//   (内訳　通常数量[口]), (内訳　積立数量[口]), 平均取得価額[円],
//   取得総額[円], 基準価額[円], 基準価額(前日比)[円], 基準価額(前月比)[円],
//   時価評価額[円], 評価損益[円], 評価損益[％], トータルリターン[円],
//   通貨単位, 未収分配金, 参考為替レート, 時価評価額[外貨], 合計額[円]
//
// 既存の `rakuten_sec_holding` (■セクション形式) と区別するため、
// 1 行目に「投資信託種別」と「ファンド」が同居していることで判定する。
export const rakutenSecJnisaAdapter: TextParserAdapter = {
  format: "text",
  code: "rakuten_sec_jnisa",
  institutionCode: "rakuten_sec_jnisa",
  label: "楽天証券 投信保有 (ジュニアNISA/NISA, スナップショット)",
  encoding: "auto",
  resultKind: "snapshot",
  detect(text: string): number {
    const head = text.slice(0, 500);
    if (/■/.test(head)) return 0; // マルチセクション形式は別アダプタ
    if (/投資信託種別/.test(head) && /ファンド/.test(head) && /時価評価額/.test(head)) {
      return 1;
    }
    return 0;
  },
  parse(text: string, fileName: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate: new Date(), holdings: [] },
        warnings: ["empty"],
      };
    }

    // 日付はファイル名から (CSV 自体に日付情報がない)
    let snapshotDate = new Date();
    const m = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (m) snapshotDate = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else {
      snapshotDate.setUTCHours(0, 0, 0, 0);
      warnings.push("ファイル名から日付を抽出できなかったため本日を採用");
    }

    const headerIdx = rows.findIndex(
      (r) => r.some((c) => /投資信託種別/.test(c)) && r.some((c) => /ファンド/.test(c)),
    );
    if (headerIdx < 0) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate, holdings: [] },
        warnings: ["ヘッダー行が見つかりません"],
      };
    }
    const header = rows[headerIdx].map((s) => s.trim());
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iName = idx(/^ファンド$|銘柄/);
    const iAccount = idx(/口座区分/);
    const iQty = idx(/^保有数量/);
    const iAvg = idx(/平均取得価額/);
    const iValueJpy = idx(/時価評価額\[円\]/);

    if (iName < 0 || iValueJpy < 0) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate, holdings: [] },
        warnings: ["必須列なし"],
      };
    }

    const holdings: ParsedHoldingRow[] = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c?.trim())) continue;
      const name = (r[iName] ?? "").trim();
      if (!name) continue;
      const acc = iAccount >= 0 ? (r[iAccount] ?? "").trim() : "";
      holdings.push({
        ticker: undefined,
        name: acc ? `${name} (${acc})` : name,
        qty: iQty >= 0 ? parseFloatJp(r[iQty]) ?? 0 : 0,
        avgCost: iAvg >= 0 ? parseFloatJp(r[iAvg]) : undefined,
        marketValue: parseAmount(r[iValueJpy]),
      });
    }
    return { kind: "snapshot", snapshot: { snapshotDate, holdings }, warnings };
  },
};
