import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const txs = await prisma.transaction.findMany({
    where: { accountId },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    select: { id: true, occurredAt: true, balance: true, memo: true },
  });
  return NextResponse.json(
    txs.map((t) => ({
      id: t.id,
      occurredAt: t.occurredAt.toISOString(),
      balance: t.balance,
      memo: t.memo,
    })),
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });
  if (account.kind !== "MANUAL") {
    return NextResponse.json({ error: "account is not MANUAL" }, { status: 400 });
  }

  const body = await req.json();
  const { date, balance, memo } = body ?? {};
  if (!date || typeof balance !== "number" || !Number.isFinite(balance)) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const occurredAt = new Date(`${date}T00:00:00.000Z`);
  if (isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }
  const balanceInt = Math.round(balance);

  const fileHash = `manual:${accountId}`;
  const manualImport = await prisma.import.upsert({
    where: { fileHash },
    update: { rowCount: { increment: 1 }, importedAt: new Date() },
    create: {
      accountId,
      fileName: "(manual)",
      fileHash,
      source: "MANUAL",
      rowCount: 1,
      status: "OK",
    },
  });

  const rowHash = crypto
    .createHash("sha256")
    .update(`${accountId}|${date}|${balanceInt}|${crypto.randomUUID()}`)
    .digest("hex");

  const tx = await prisma.transaction.create({
    data: {
      accountId,
      importId: manualImport.id,
      occurredAt,
      amount: 0,
      balance: balanceInt,
      payee: "残高記録",
      memo: memo ? String(memo) : null,
      raw: "{}",
      rowHash,
    },
    select: { id: true, occurredAt: true, balance: true, memo: true },
  });

  return NextResponse.json({
    id: tx.id,
    occurredAt: tx.occurredAt.toISOString(),
    balance: tx.balance,
    memo: tx.memo,
  });
}
