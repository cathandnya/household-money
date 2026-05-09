import { prisma } from "./db";

export type AccountSummary = {
  accountId: number;
  accountName: string;
  institutionName: string;
  kind: string;
  balance: number; // 現金口座は最新の Transaction.balance、証券/DC は最新 snapshot 評価額
  asOf: string | null;
};

export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const accounts = await prisma.account.findMany({ include: { institution: true } });
  const out: AccountSummary[] = [];
  for (const acc of accounts) {
    if (acc.kind === "BROKERAGE" || acc.kind === "DC") {
      const snap = await prisma.holdingSnapshot.findFirst({
        where: { accountId: acc.id },
        orderBy: { snapshotDate: "desc" },
        include: { holdings: true },
      });
      const total = snap ? snap.holdings.reduce((s, h) => s + h.marketValue, 0) : 0;
      out.push({
        accountId: acc.id,
        accountName: acc.name,
        institutionName: acc.institution.name,
        kind: acc.kind,
        balance: total,
        asOf: snap ? snap.snapshotDate.toISOString() : null,
      });
    } else {
      const last = await prisma.transaction.findFirst({
        where: { accountId: acc.id, balance: { not: null } },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      });
      out.push({
        accountId: acc.id,
        accountName: acc.name,
        institutionName: acc.institution.name,
        kind: acc.kind,
        balance: last?.balance ?? 0,
        asOf: last ? last.occurredAt.toISOString() : null,
      });
    }
  }
  return out;
}

export type MonthlyCategory = {
  month: string; // YYYY-MM
  categoryId: number | null;
  categoryName: string;
  kind: string | null;
  amount: number; // 円。支出は負、収入は正のまま集計
};

export async function getMonthlyCategorySummary(months = 12): Promise<MonthlyCategory[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const txs = await prisma.transaction.findMany({
    where: { occurredAt: { gte: since } },
    include: { category: true },
  });
  const map = new Map<string, MonthlyCategory>();
  for (const t of txs) {
    const month = t.occurredAt.toISOString().slice(0, 7);
    const key = `${month}|${t.categoryId ?? "null"}`;
    const existing = map.get(key);
    const entry: MonthlyCategory = existing ?? {
      month,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? "未分類",
      kind: t.category?.kind ?? null,
      amount: 0,
    };
    entry.amount += t.amount;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) =>
    a.month === b.month ? a.categoryName.localeCompare(b.categoryName) : b.month.localeCompare(a.month),
  );
}

// 日次の資産推移 (現金口座は balance の各日最終値、証券は snapshot 日のみ、未取得日は前方補完して合算)
export async function getAssetTimeline(days = 365): Promise<Array<{ date: string; total: number }>> {
  const accounts = await prisma.account.findMany();
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setUTCHours(0, 0, 0, 0);

  // 各口座ごとに「日付 → 値」マップを作る
  const perAccount: Map<number, Map<string, number>> = new Map();
  for (const acc of accounts) {
    const m = new Map<string, number>();
    if (acc.kind === "BROKERAGE" || acc.kind === "DC") {
      const snaps = await prisma.holdingSnapshot.findMany({
        where: { accountId: acc.id },
        include: { holdings: true },
        orderBy: { snapshotDate: "asc" },
      });
      for (const s of snaps) {
        m.set(s.snapshotDate.toISOString().slice(0, 10), s.holdings.reduce((x, h) => x + h.marketValue, 0));
      }
    } else {
      const txs = await prisma.transaction.findMany({
        where: { accountId: acc.id, balance: { not: null } },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      });
      for (const t of txs) {
        if (t.balance == null) continue;
        m.set(t.occurredAt.toISOString().slice(0, 10), t.balance);
      }
    }
    perAccount.set(acc.id, m);
  }

  // 日付列挙
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dates: string[] = [];
  for (let d = new Date(since); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }

  const out: Array<{ date: string; total: number }> = [];
  const lastValues = new Map<number, number>();
  for (const date of dates) {
    let total = 0;
    for (const [accId, m] of perAccount) {
      if (m.has(date)) lastValues.set(accId, m.get(date)!);
      total += lastValues.get(accId) ?? 0;
    }
    out.push({ date, total });
  }
  return out;
}
