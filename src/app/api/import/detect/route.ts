import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { adapters } from "@/lib/parsers/registry";
import { decodeBuffer } from "@/lib/parsers/encoding";

export const runtime = "nodejs";

// CSV を投げるとマッチしたアダプタと候補口座を返す。
// マッチが無い、複数候補が同点で並ぶ場合はユーザに選んでもらう。
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());

  // ファイルが PDF か CSV/テキストかを先頭バイトで判別。
  const isPdf =
    /\.pdf$/i.test(file.name) ||
    file.type === "application/pdf" ||
    buf.slice(0, 4).toString() === "%PDF";

  // 該当 format のアダプタにのみ detect を回す。
  const scored = await Promise.all(
    adapters
      .filter((a) => (isPdf ? a.format === "pdf" : a.format === "text"))
      .map(async (a) => {
        let score: number;
        if (a.format === "pdf") {
          score = await a.detect(buf, file.name);
        } else {
          const text = decodeBuffer(buf, a.encoding);
          score = a.detect(text, file.name);
        }
        return { adapter: a, score };
      }),
  );

  const matched = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  const top = matched[0];

  // institution code -> 候補口座
  let candidateAccounts: Array<{ id: number; name: string; kind: string }> = [];
  let institution: { id: number; code: string; name: string } | null = null;
  if (top) {
    const inst = await prisma.institution.findUnique({
      where: { code: top.adapter.institutionCode },
    });
    if (inst) {
      institution = { id: inst.id, code: inst.code, name: inst.name };
      const accs = await prisma.account.findMany({
        where: { institutionId: inst.id },
        orderBy: { id: "asc" },
      });
      candidateAccounts = accs.map((a) => ({ id: a.id, name: a.name, kind: a.kind }));
    }
  }

  return NextResponse.json({
    matched: matched.map((m) => ({
      adapterCode: m.adapter.code,
      adapterLabel: m.adapter.label,
      institutionCode: m.adapter.institutionCode,
      resultKind: m.adapter.resultKind,
      score: m.score,
    })),
    top: top
      ? {
          adapterCode: top.adapter.code,
          adapterLabel: top.adapter.label,
          institutionCode: top.adapter.institutionCode,
          resultKind: top.adapter.resultKind,
          score: top.score,
        }
      : null,
    institution,
    candidateAccounts,
    autoSelectedAccountId:
      candidateAccounts.length === 1 ? candidateAccounts[0].id : null,
  });
}
