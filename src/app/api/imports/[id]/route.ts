import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const importId = Number(id);
  if (!Number.isInteger(importId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const rec = await prisma.import.findUnique({ where: { id: importId } });
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Transaction / SecurityTransaction / HoldingSnapshot の FK は onDelete 未指定なので明示的に消す。
  // Holding は HoldingSnapshot.holdings 経由で onDelete: Cascade が効くので自動削除される。
  const [tx, secTx, snapshot] = await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { importId } }),
    prisma.securityTransaction.deleteMany({ where: { importId } }),
    prisma.holdingSnapshot.deleteMany({ where: { importId } }),
    prisma.import.delete({ where: { id: importId } }),
  ]);

  return NextResponse.json({
    ok: true,
    deleted: { tx: tx.count, secTx: secTx.count, snapshot: snapshot.count },
  });
}
