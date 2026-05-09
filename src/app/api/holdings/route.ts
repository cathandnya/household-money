import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// 全口座の最新スナップショットの保有を返す
export async function GET() {
  const accounts = await prisma.account.findMany({
    where: { kind: { in: ["BROKERAGE", "DC"] } },
    include: { institution: true },
  });
  const result: Array<{
    accountId: number;
    accountName: string;
    institutionName: string;
    snapshotDate: string | null;
    holdings: Array<{
      ticker: string | null;
      name: string;
      qty: number;
      avgCost: number | null;
      marketValue: number;
      currency: string;
    }>;
  }> = [];
  for (const acc of accounts) {
    const snap = await prisma.holdingSnapshot.findFirst({
      where: { accountId: acc.id },
      orderBy: { snapshotDate: "desc" },
      include: { holdings: true },
    });
    result.push({
      accountId: acc.id,
      accountName: acc.name,
      institutionName: acc.institution.name,
      snapshotDate: snap ? snap.snapshotDate.toISOString() : null,
      holdings: snap
        ? snap.holdings.map((h) => ({
            ticker: h.ticker,
            name: h.name,
            qty: h.qty,
            avgCost: h.avgCost,
            marketValue: h.marketValue,
            currency: h.currency,
          }))
        : [],
    });
  }
  return NextResponse.json(result);
}
