import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const cats = await prisma.category.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(cats);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, kind } = body ?? {};
  if (!name || !kind) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const cat = await prisma.category.create({
    data: { name: String(name), kind: String(kind) },
  });
  return NextResponse.json(cat);
}
