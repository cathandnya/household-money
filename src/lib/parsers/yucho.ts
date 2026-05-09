import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// ゆうちょ銀行 (ゆうちょダイレクト) 入出金明細
// 想定ヘッダ例: お取扱日,払出金額,預入金額,残高,備考  (口座種別で多少差異)
export const yuchoAdapter: ParserAdapter = {
  code: "yucho",
  institutionCode: "yucho",
  label: "ゆうちょ銀行 入出金明細",
  encoding: "sjis",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 500);
    if (/お取扱日/.test(head) && (/払出/.test(head) || /預入/.test(head))) return 1;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /取扱日|取引日|日付/.test(c)),
    );
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/取扱日|取引日|日付/);
    const iOut = idx(/払出|出金/);
    const iIn = idx(/預入|入金/);
    const iBalance = idx(/残高/);
    const iPayee = idx(/備考|摘要|お取扱内容|内容/);
    if (iDate < 0) return { kind: "tx", rows: [], warnings: ["日付列なし"] };

    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const out_ = iOut >= 0 ? parseAmount(r[iOut]) : 0;
      const in_ = iIn >= 0 ? parseAmount(r[iIn]) : 0;
      const amount = in_ - out_;
      const balance = iBalance >= 0 ? parseAmount(r[iBalance]) : undefined;
      const payee = (iPayee >= 0 ? r[iPayee] : "")?.trim() ?? "";
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({ occurredAt: date, amount, balance, payee, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
