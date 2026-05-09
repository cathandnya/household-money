import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// 三井住友カード Vpass 利用明細 CSV (Shift_JIS, ヘッダーレス)
// 1行目: 「氏名,カード番号,カード名」のメタ情報行
// 2行目以降: 利用日,利用先,利用金額,支払区分,今回回数,お支払い金額,手数料
//   例: 2026/03/16,ヨドバシカメラ　通信販売,3723,１,１,3723,
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

    // 1行目から日付っぽい列を含まなければスキップ (カードメタ情報行)
    let startIdx = 0;
    if (rows[0] && !parseJpDate(rows[0][0] ?? "")) {
      startIdx = 1;
    }

    const out: ParsedTxRow[] = [];
    for (let i = startIdx; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[0] ?? "");
      if (!date) continue;

      const payee = (r[1] ?? "").trim();
      // お支払い金額 (列 5) を優先、無ければ利用金額 (列 2)
      const payAmount = parseAmount(r[5] ?? "");
      const useAmount = parseAmount(r[2] ?? "");
      const amountAbs = payAmount || useAmount;
      const amount = -Math.abs(amountAbs); // カード利用は出金扱い

      const raw: Record<string, string> = {};
      r.forEach((c, i) => (raw[`col${i}`] = c ?? ""));
      out.push({ occurredAt: date, amount, payee, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
