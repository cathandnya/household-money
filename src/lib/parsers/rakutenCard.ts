import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// 楽天カード 利用明細 CSV (UTF-8)
// ヘッダ例: 利用日,利用店名・商品名,利用者,支払方法,利用金額,支払手数料,支払総額,...
export const rakutenCardAdapter: ParserAdapter = {
  code: "rakuten_card",
  institutionCode: "rakuten_card",
  label: "楽天カード 利用明細",
  encoding: "auto",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 500);
    // 「6月繰越残高」「6月以降支払金額」「支払総額」など楽天カード特有
    if (/利用日/.test(head) && /利用店名・商品名/.test(head) && /支払総額/.test(head)) return 1;
    if (/利用日/.test(head) && /利用店名/.test(head) && /利用金額/.test(head)) return 0.7;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    const headerIdx = rows.findIndex(
      (r) => r.some((c) => /利用日/.test(c)) && r.some((c) => /利用店|店名|商品名/.test(c)),
    );
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/利用日/);
    const iPayee = idx(/利用店|商品名/);
    const iAmount = idx(/(支払総額|利用金額|お支払い金額)/);
    const iUser = idx(/利用者/);
    if (iDate < 0 || iPayee < 0 || iAmount < 0) {
      return { kind: "tx", rows: [], warnings: ["必須列なし"] };
    }
    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const amount = -Math.abs(parseAmount(r[iAmount]));
      const payee = (r[iPayee] ?? "").trim();
      const memo = iUser >= 0 ? r[iUser]?.trim() : undefined;
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({ occurredAt: date, amount, payee, memo, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
