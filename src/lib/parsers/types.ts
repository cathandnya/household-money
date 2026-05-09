export type ParsedTxRow = {
  occurredAt: Date;
  amount: number; // 円、入金 +、出金 -
  balance?: number;
  payee: string;
  memo?: string;
  raw: Record<string, string>;
};

export type ParsedSecTxRow = {
  tradedAt: Date;
  ticker?: string;
  name: string;
  side: "BUY" | "SELL" | "DIVIDEND" | "DEPOSIT" | "WITHDRAW" | "FEE" | "OTHER";
  qty?: number;
  price?: number;
  amount: number;
  fee?: number;
  raw: Record<string, string>;
};

export type ParsedHoldingRow = {
  ticker?: string;
  name: string;
  qty: number;
  avgCost?: number;
  marketValue: number;
  currency?: string;
};

export type ParsedSnapshot = {
  snapshotDate: Date;
  holdings: ParsedHoldingRow[];
};

export type ParseResult =
  | { kind: "tx"; rows: ParsedTxRow[]; warnings: string[] }
  | { kind: "sec_tx"; rows: ParsedSecTxRow[]; warnings: string[] }
  | { kind: "snapshot"; snapshot: ParsedSnapshot; warnings: string[] };

// CSV / TXT 等のテキストベースアダプタ
export type TextParserAdapter = {
  format: "text";
  code: string;
  institutionCode: string;
  label: string;
  encoding: "sjis" | "utf8" | "jis" | "auto";
  resultKind: "tx" | "sec_tx" | "snapshot";
  detect(text: string, fileName: string): number;
  parse(text: string, fileName: string): ParseResult;
};

// PDF アダプタ (バイナリ入力)
export type PdfParserAdapter = {
  format: "pdf";
  code: string;
  institutionCode: string;
  label: string;
  resultKind: "tx" | "sec_tx" | "snapshot";
  detect(buf: Buffer, fileName: string): Promise<number> | number;
  parse(buf: Buffer, fileName: string): Promise<ParseResult>;
};

export type ParserAdapter = TextParserAdapter | PdfParserAdapter;
