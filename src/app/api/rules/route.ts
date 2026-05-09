import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { recategorizeAll } from "@/lib/categorize";

export const runtime = "nodejs";

export async function GET() {
  const rules = await prisma.rule.findMany({
    include: { category: true },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pattern, isRegex, field, priority, accountKindFilter, categoryId, enabled } = body ?? {};
  if (!pattern || !categoryId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const rule = await prisma.rule.create({
    data: {
      pattern: String(pattern),
      isRegex: !!isRegex,
      field: field === "MEMO" ? "MEMO" : "PAYEE",
      priority: Number(priority ?? 100),
      accountKindFilter: accountKindFilter || null,
      categoryId: Number(categoryId),
      enabled: enabled ?? true,
    },
  });
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.rule.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
