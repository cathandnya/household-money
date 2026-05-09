import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isFinite(accountId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json();
  const { name, kind, currency } = body ?? {};
  const data: { name?: string; kind?: string; currency?: string } = {};
  if (name !== undefined) data.name = String(name);
  if (kind !== undefined) data.kind = String(kind);
  if (currency !== undefined) data.currency = String(currency);
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }
  const account = await prisma.account.update({
    where: { id: accountId },
    data,
  });
  return NextResponse.json(account);
}
