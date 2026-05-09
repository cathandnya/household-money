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
}): string {
  const key = [
    parts.accountId,
    parts.occurredAt.toISOString().slice(0, 10),
    parts.amount,
    parts.payee.trim(),
    parts.balance ?? "",
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
}): string {
  const key = [
    parts.accountId,
    parts.tradedAt.toISOString().slice(0, 10),
    parts.side,
    parts.ticker ?? "",
    parts.name.trim(),
    parts.amount,
    parts.qty ?? "",
  ].join("|");
  return sha256(key);
}
