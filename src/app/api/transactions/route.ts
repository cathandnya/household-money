import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const accountId = searchParams.get("accountId");
  const categoryId = searchParams.get("categoryId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = Math.min(Number(searchParams.get("limit") ?? 200), 1000);

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [{ payee: { contains: q } }, { memo: { contains: q } }];
  }
  if (accountId) where.accountId = Number(accountId);
  if (categoryId === "null") where.categoryId = null;
  else if (categoryId) where.categoryId = Number(categoryId);
  if (from || to) {
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = new Date(from);
    if (to) range.lte = new Date(to);
    where.occurredAt = range;
  }

  const txs = await prisma.transaction.findMany({
    where: where as Parameters<typeof prisma.transaction.findMany>[0] extends { where?: infer W }
      ? W
      : never,
    include: { account: { include: { institution: true } }, category: true },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit,
  });
  return NextResponse.json(txs);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, categoryId } = body ?? {};
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const tx = await prisma.transaction.update({
    where: { id: Number(id) },
    data: { categoryId: categoryId == null ? null : Number(categoryId) },
  });
  return NextResponse.json(tx);
}
