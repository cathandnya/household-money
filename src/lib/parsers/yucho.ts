import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// ゆうちょ銀行 (ゆうちょダイレクト) 入出金明細 CSV (Shift_JIS)
//
// 形式:
//   先頭にメタ情報行が数行 (お客さま口座情報 / 現在高 / 出力日時 / 口座番号 など)
//   その後にヘッダ行: 取引日, 入出金明細ＩＤ, 受入金額（円）, 払出金額（円）, 詳細１, 詳細２, 現在(貸付)高
//   日付は YYYYMMDD の固定 8 桁数値。
//   摘要は詳細１ + 詳細２ (例: 「ＰＥ」+「法務省」)
export const yuchoAdapter: ParserAdapter = {
  code: "yucho",
  institutionCode: "yucho",
  label: "ゆうちょ銀行 入出金明細",
  encoding: "sjis",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 1000);
    if (/お客さま口座情報/.test(head) && /取引日/.test(head)) return 1;
    if (/入出金明細ＩＤ/.test(head)) return 1;
    if (/お取扱日/.test(head) && (/払出/.test(head) || /預入/.test(head))) return 0.8;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    // ヘッダ行: 「取引日」を含む & 受入/払出/明細ＩＤ等の列がある
    const headerIdx = rows.findIndex(
      (r) =>
        r.some((c) => /取引日|取扱日|日付/.test(c)) &&
        r.some((c) => /(受入|払出|預入|入金|出金|明細|金額)/.test(c)),
    );
    if (headerIdx < 0) return { kind: "tx", rows: [], warnings: ["ヘッダー行が見つかりません"] };

    const header = rows[headerIdx].map((s) => s.trim());
    const dataRows = rows.slice(headerIdx + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/取引日|取扱日|日付/);
    // 「入出金明細ＩＤ」と取り違えないよう「金額」を必須にする
    const iIn = header.findIndex((h) => /(受入金額|預入金額|入金額|入金\s*\(円\))/.test(h));
    const iOut = header.findIndex((h) => /(払出金額|出金額|出金\s*\(円\))/.test(h));
    const iBalance = idx(/現在.*高|残高/);
    const iDetail1 = idx(/詳細１|詳細1/);
    const iDetail2 = idx(/詳細２|詳細2/);
    const iPayeeFallback = idx(/備考|摘要|お取扱内容|内容/);
    if (iDate < 0) return { kind: "tx", rows: [], warnings: ["日付列なし"] };

    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const out_ = iOut >= 0 ? parseAmount(r[iOut]) : 0;
      const in_ = iIn >= 0 ? parseAmount(r[iIn]) : 0;
      const amount = in_ - out_;
      // 残高は空欄のことがある (同日複数取引の 2 件目以降)。空欄は undefined にしておき
      // ダッシュボード集計で「最後に残高が書かれた行」を採用させる。
      const balanceCell = iBalance >= 0 ? (r[iBalance] ?? "").trim() : "";
      const balance = balanceCell ? parseAmount(balanceCell) : undefined;

      // 摘要: 詳細1 + 詳細2 を結合、無ければ備考列にフォールバック
      let payee = "";
      if (iDetail1 >= 0 || iDetail2 >= 0) {
        const d1 = (iDetail1 >= 0 ? r[iDetail1] : "")?.trim() ?? "";
        const d2 = (iDetail2 >= 0 ? r[iDetail2] : "")?.trim() ?? "";
        payee = [d1, d2].filter(Boolean).join(" ");
      } else if (iPayeeFallback >= 0) {
        payee = (r[iPayeeFallback] ?? "").trim();
      }

      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({ occurredAt: date, amount, balance, payee, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
