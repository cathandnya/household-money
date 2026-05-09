import { NextResponse } from "next/server";
import { recategorizeAll } from "@/lib/categorize";

export const runtime = "nodejs";

export async function POST() {
  const updated = await recategorizeAll();
  return NextResponse.json({ updated });
}
