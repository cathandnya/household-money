import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const accounts = await prisma.account.findMany({
    include: { institution: true },
    orderBy: [{ institutionId: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { institutionId, name, kind, currency } = body ?? {};
  if (!institutionId || !name || !kind) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const account = await prisma.account.create({
    data: {
      institutionId: Number(institutionId),
      name: String(name),
      kind: String(kind),
      currency: currency ? String(currency) : "JPY",
    },
  });
  return NextResponse.json(account);
}
