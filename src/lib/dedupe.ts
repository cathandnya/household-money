import { createHash } from "node:crypto";

export function sha256(buf: Buffer | string): string {
  const h = createHash("sha256");
  h.update(buf);
  return h.digest("hex");
}

export function txRowHash(parts: {
  accountId: number;
  occurredAt: Date;
  amount: number;
  payee: string;
  balance?: number | null;
  seq?: number; // 同キー内の連番 (同日同店同額の独立取引を区別する)
}): string {
  const key = [
    parts.accountId,
    parts.occurredAt.toISOString().slice(0, 10),
    parts.amount,
    parts.payee.trim(),
    parts.balance ?? "",
    parts.seq ?? 0,
  ].join("|");
  return sha256(key);
}

export function secTxRowHash(parts: {
  accountId: number;
  tradedAt: Date;
  side: string;
  name: string;
  ticker?: string;
  amount: number;
  qty?: number;
  seq?: number;
}): string {
  const key = [
    parts.accountId,
    parts.tradedAt.toISOString().slice(0, 10),
    parts.side,
    parts.ticker ?? "",
    parts.name.trim(),
    parts.amount,
    parts.qty ?? "",
    parts.seq ?? 0,
  ].join("|");
  return sha256(key);
}

// 連番を割り振るヘルパー: 同じベースキーが何回目に出てきたかを 0,1,2... と返す
export function makeSeqAssigner<K>(): (key: K) => number {
  const counts = new Map<K, number>();
  return (key) => {
    const cur = counts.get(key) ?? 0;
    counts.set(key, cur + 1);
    return cur;
  };
}
