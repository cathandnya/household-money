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

export type ParserAdapter = {
  code: string;                              // institution code
  label: string;
  encoding: "sjis" | "utf8" | "jis" | "auto";
  resultKind: "tx" | "sec_tx" | "snapshot";
  parse(text: string, fileName: string): ParseResult;
};
