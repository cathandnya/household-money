import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> },
) {
  const { id, entryId } = await params;
  const accountId = Number(id);
  const txId = Number(entryId);
  if (!Number.isFinite(accountId) || !Number.isFinite(txId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const tx = await prisma.transaction.findUnique({ where: { id: txId } });
  if (!tx || tx.accountId !== accountId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await prisma.transaction.delete({ where: { id: txId } });
  await prisma.import.update({
    where: { id: tx.importId },
    data: { rowCount: { decrement: 1 } },
  });
  return NextResponse.json({ ok: true });
}
