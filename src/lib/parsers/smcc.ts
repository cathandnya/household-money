import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// 三井住友カード Vpass 利用明細 CSV (Shift_JIS)
// ヘッダ例: ご利用日,ご利用場所,ご利用者,支払区分,今回回数,お支払い金額
export const smccAdapter: ParserAdapter = {
  code: "smcc",
  label: "三井住友カード 利用明細",
  encoding: "sjis",
  resultKind: "tx",
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };
    const headerIdx = rows.findIndex(
      (r) => r.some((c) => /利用日/.test(c)) && r.some((c) => /利用(場所|店|先)/.test(c)),
    );
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/利用日/);
    const iPayee = idx(/利用(場所|店|先)/);
    const iAmount = idx(/(お支払い金額|支払金額|利用金額)/);
    const iUser = idx(/利用者/);
    if (iDate < 0 || iPayee < 0 || iAmount < 0) {
      return { kind: "tx", rows: [], warnings: ["必須列なし"] };
    }
    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const amount = -Math.abs(parseAmount(r[iAmount])); // カード利用は出金扱い
      const payee = (r[iPayee] ?? "").trim();
      const memo = iUser >= 0 ? r[iUser]?.trim() : undefined;
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({ occurredAt: date, amount, payee, memo, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
