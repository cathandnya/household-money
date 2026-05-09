import { NextRequest, NextResponse } from "next/server";
import { getAccountSummaries, getAssetTimeline, getMonthlyCategorySummary } from "@/lib/aggregate";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? 365);
  const months = Number(searchParams.get("months") ?? 12);
  const [accounts, timeline, monthly] = await Promise.all([
    getAccountSummaries(),
    getAssetTimeline(days),
    getMonthlyCategorySummary(months),
  ]);
  return NextResponse.json({ accounts, timeline, monthly });
}
