import Papa from "papaparse";
import type { ParsedTxRow, TextParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// 三井住友カード Vpass 利用明細 CSV (Shift_JIS, ヘッダーレス)
// 列: 利用日, 利用先, 会員区分, 支払区分, (空), 支払月 ('YY/MM), 利用金額, お支払い金額, ...
//   例: 2026/6/15,無印良品（ネットストア）,ご本人,1回払い,,'26/07,3645,3645,,,,,
// 旧フォーマット (列が短い): 利用日, 利用先, 利用金額, 支払区分, 今回回数, お支払い金額, 手数料
//   例: 2026/03/16,ヨドバシカメラ　通信販売,3723,１,１,3723,
// 旧フォーマットには 1行目に「氏名,カード番号(****マスク),カード名」のメタ情報行があった
export const smccAdapter: TextParserAdapter = {
  format: "text",
  code: "smcc",
  institutionCode: "smcc",
  label: "三井住友カード 利用明細",
  encoding: "sjis",
  resultKind: "tx",
  detect(text: string): number {
    const lines = text.split(/\r?\n/);
    const firstLine = lines[0] ?? "";
    // 旧フォーマット: 1行目が「氏名,カード番号(****マスク),カード名」のメタ情報行
    if (/\*+-\*+/.test(firstLine) && /様/.test(firstLine)) return 1;
    if (/様/.test(firstLine) && /VISA|ＶＩＳＡ|Mastercard|ＭＡＳＴＥＲ/i.test(firstLine)) return 0.9;
    // 新フォーマット: ヘッダーレスで 1行目から利用明細。
    // 「日付,文字列,ご本人/家族,N回払い,...,'YY/MM,金額,金額」のパターンで判定
    for (const line of lines.slice(0, 3)) {
      if (!line.trim()) continue;
      if (
        /^\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2},[^,]+,(ご本人|家族),[^,]*払い,/.test(line) &&
        /,'\d{2}\/\d{2},/.test(line)
      ) {
        return 1;
      }
    }
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    // 1行目から日付っぽい列を含まなければスキップ (旧フォーマットのカードメタ情報行)
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
      // 新フォーマット (列3が「N回払い」): お支払い金額=列7、利用金額=列6
      // 旧フォーマット: お支払い金額=列5、利用金額=列2
      const isNewFormat = /払い/.test(r[3] ?? "");
      const payAmount = isNewFormat ? parseAmount(r[7] ?? "") : parseAmount(r[5] ?? "");
      const useAmount = isNewFormat ? parseAmount(r[6] ?? "") : parseAmount(r[2] ?? "");
      const amountAbs = payAmount || useAmount;
      const amount = -Math.abs(amountAbs); // カード利用は出金扱い

      const raw: Record<string, string> = {};
      r.forEach((c, i) => (raw[`col${i}`] = c ?? ""));
      out.push({ occurredAt: date, amount, payee, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
