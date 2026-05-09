import Papa from "papaparse";
import type { ParsedHoldingRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseFloatJp } from "./util";

// SBIベネフィットシステムズ (確定拠出年金) 保有商品スナップショット
// 仕様詳細不明のため、ヘッダから「商品名/数量/評価額」を緩く抽出する。
// 取引明細のサポートは見送り (snapshot のみ)。
export const sbiBenefitAdapter: ParserAdapter = {
  code: "sbi_benefit",
  label: "SBIベネフィット 残高スナップショット",
  encoding: "auto",
  resultKind: "snapshot",
  parse(text: string, fileName: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];

    let snapshotDate = new Date();
    const m = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
    if (m) snapshotDate = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    else {
      snapshotDate.setUTCHours(0, 0, 0, 0);
      warnings.push("ファイル名から日付を抽出できなかったため本日を採用");
    }

    const headerIdx = rows.findIndex(
      (r) =>
        r.some((c) => /商品名|銘柄|ファンド/.test(c)) &&
        r.some((c) => /評価額|時価|残高/.test(c)),
    );
    if (headerIdx < 0)
      return { kind: "snapshot", snapshot: { snapshotDate, holdings: [] }, warnings: ["ヘッダー検出失敗"] };
    const header = rows[headerIdx].map((s) => s.trim());
    const dataRows = rows.slice(headerIdx + 1);
    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iName = idx(/商品名|銘柄|ファンド/);
    const iQty = idx(/口数|数量/);
    const iAvg = idx(/取得|平均/);
    const iValue = idx(/評価額|時価|残高/);

    const holdings: ParsedHoldingRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const name = (r[iName] ?? "").trim();
      if (!name) continue;
      holdings.push({
        name,
        qty: iQty >= 0 ? parseFloatJp(r[iQty]) ?? 0 : 0,
        avgCost: iAvg >= 0 ? parseFloatJp(r[iAvg]) : undefined,
        marketValue: parseAmount(r[iValue]),
      });
    }
    return { kind: "snapshot", snapshot: { snapshotDate, holdings }, warnings };
  },
};
