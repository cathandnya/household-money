import { prisma } from "./db";
import { assetGroupOf, type AssetGroup } from "./accountKinds";

export type AccountSummary = {
  accountId: number;
  accountName: string;
  institutionName: string;
  institutionCode: string;
  kind: string;
  balance: number; // 現金口座は最新の Transaction.balance、証券/DC は最新 snapshot 評価額
  // 証券/DC の取得総額 (最新 snapshot の holding.cost 合計)。損益 = balance - cost。
  // 取得額が取れない口座 (現金・手動入力や cost 欠損) は null とし損益を出さない。
  cost: number | null;
  asOf: string | null;
};

export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const accounts = await prisma.account.findMany({ include: { institution: true } });
  const out: AccountSummary[] = [];
  for (const acc of accounts) {
    const lastImport = await prisma.import.findFirst({
      where: { accountId: acc.id },
      orderBy: { importedAt: "desc" },
      select: { importedAt: true },
    });
    const asOf = lastImport ? lastImport.importedAt.toISOString() : null;

    if (acc.kind === "BROKERAGE" || acc.kind === "DC") {
      const snap = await prisma.holdingSnapshot.findFirst({
        where: { accountId: acc.id },
        orderBy: { snapshotDate: "desc" },
        include: { holdings: true },
      });
      const total = snap ? snap.holdings.reduce((s, h) => s + h.marketValue, 0) : 0;
      // 取得総額: holding が 1 つでも cost 欠損なら損益を出せないので null
      const cost =
        snap && snap.holdings.length > 0 && snap.holdings.every((h) => h.cost != null)
          ? snap.holdings.reduce((s, h) => s + (h.cost ?? 0), 0)
          : null;
      out.push({
        accountId: acc.id,
        accountName: acc.name,
        institutionName: acc.institution.name,
        institutionCode: acc.institution.code,
        kind: acc.kind,
        balance: total,
        cost,
        asOf,
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
        institutionCode: acc.institution.code,
        kind: acc.kind,
        balance: last?.balance ?? 0,
        cost: null,
        asOf,
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

export type MonthlyFlow = { month: string; income: number; expense: number };

// 月別の収入/支出合計。category.kind があればそれに従い、未分類は金額の符号で判定。
// TRANSFER (口座振替・カード引落) は除外。
export async function getMonthlyIncomeExpense(months = 12): Promise<MonthlyFlow[]> {
  const since = new Date();
  since.setMonth(since.getMonth() - months);
  since.setUTCDate(1);
  since.setUTCHours(0, 0, 0, 0);

  const txs = await prisma.transaction.findMany({
    where: { occurredAt: { gte: since } },
    include: { category: true },
  });
  const map = new Map<string, MonthlyFlow>();
  for (const t of txs) {
    const kind = t.category?.kind;
    if (kind === "TRANSFER") continue;
    const month = t.occurredAt.toISOString().slice(0, 7);
    const flow = map.get(month) ?? { month, income: 0, expense: 0 };
    const isIncome = kind === "INCOME" || (kind == null && t.amount > 0);
    const isExpense = kind === "EXPENSE" || (kind == null && t.amount < 0);
    if (isIncome) flow.income += t.amount;
    else if (isExpense) flow.expense += t.amount;
    map.set(month, flow);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// 日次の資産推移。総額 (total) に加え、資産グループ別 (現金/投資信託/年金) の
// 値も返す。銀行は balance の各日最終値、証券/DC は snapshot 日のみ、未取得日は
// 前方補完して合算。クレカは除外。
export type AssetTimelinePoint = { date: string; total: number } & Record<AssetGroup, number>;

export async function getAssetTimeline(days = 365): Promise<AssetTimelinePoint[]> {
  const accounts = await prisma.account.findMany({
    where: { kind: { not: "CREDIT_CARD" } },
  });
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

  // 口座 ID → 資産グループ (対象外の種別は除外済みだが念のため null はスキップ)
  const groupOf = new Map<number, AssetGroup>();
  for (const acc of accounts) {
    const g = assetGroupOf(acc.kind);
    if (g) groupOf.set(acc.id, g);
  }

  const out: AssetTimelinePoint[] = [];
  const lastValues = new Map<number, number>();
  for (const date of dates) {
    const byGroup: Record<AssetGroup, number> = { CASH: 0, FUND: 0, PENSION: 0 };
    let total = 0;
    for (const [accId, m] of perAccount) {
      if (m.has(date)) lastValues.set(accId, m.get(date)!);
      const v = lastValues.get(accId) ?? 0;
      total += v;
      const g = groupOf.get(accId);
      if (g) byGroup[g] += v;
    }
    out.push({ date, total, ...byGroup });
  }
  return out;
}
