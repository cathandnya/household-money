// 全口座について、同日タイ (same accountId + same DATE(occurredAt), balance not null)
// のグループを id ASC で並べたときに、時系列 DESC (= 新→古) の順で入っているか、
// 時系列 ASC (= 古→新、正しい) の順で入っているかを balance チェーンで判定する。
//
// 判定ロジック:
//   グループ [r0, r1, ..., rN] (id ASC) について、
//     - 全ペアで r[i-1].balance + r[i].amount == r[i].balance なら chronological (OK)
//     - 全ペアで r[i+1].balance + r[i].amount == r[i].balance なら reversed (要修正)
//     - どちらでもなければ ambiguous (取引が入り混じっている等)
//
// 使い方:  node scripts/with-env.mjs npx tsx scripts/diagnose-tx-order.ts

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "file:./data/money.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

type Direction = "chronological" | "reversed" | "ambiguous";

function detect(rows: { amount: number; balance: number | null }[]): Direction {
  if (rows.length < 2) return "chronological";
  if (rows.some((r) => r.balance == null)) return "ambiguous";
  let asc = true;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i - 1].balance! + rows[i].amount !== rows[i].balance!) {
      asc = false;
      break;
    }
  }
  if (asc) return "chronological";
  let desc = true;
  for (let i = 0; i < rows.length - 1; i++) {
    if (rows[i + 1].balance! + rows[i].amount !== rows[i].balance!) {
      desc = false;
      break;
    }
  }
  if (desc) return "reversed";
  return "ambiguous";
}

async function main() {
  const accounts = await prisma.account.findMany({
    include: { institution: true },
    where: { kind: { notIn: ["BROKERAGE", "DC", "CREDIT_CARD"] } },
  });

  type Summary = {
    accountLabel: string;
    institutionCode: string;
    groups: number;
    chronological: number;
    reversed: number;
    ambiguous: number;
  };
  const summary: Summary[] = [];

  for (const acc of accounts) {
    const txs = await prisma.transaction.findMany({
      where: { accountId: acc.id, balance: { not: null } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    const groups = new Map<string, typeof txs>();
    for (const t of txs) {
      const k = t.occurredAt.toISOString().slice(0, 10);
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }

    const s: Summary = {
      accountLabel: `${acc.institution.code}/${acc.name}`,
      institutionCode: acc.institution.code,
      groups: 0,
      chronological: 0,
      reversed: 0,
      ambiguous: 0,
    };

    for (const [day, rows] of groups) {
      if (rows.length < 2) continue;
      s.groups++;
      const dir = detect(rows);
      s[dir]++;
      if (dir === "reversed" || dir === "ambiguous") {
        console.log(
          `[${dir}] ${s.accountLabel} ${day} n=${rows.length}`,
        );
        for (const r of rows) {
          console.log(
            `    id=${r.id} amount=${r.amount} balance=${r.balance} payee=${r.payee}`,
          );
        }
      }
    }

    if (s.groups > 0) summary.push(s);
  }

  console.log("");
  console.log("=== summary (accounts with same-day ties) ===");
  console.log(
    "code".padEnd(14) +
      "account".padEnd(20) +
      "groups".padStart(8) +
      "chron".padStart(8) +
      "reversed".padStart(10) +
      "ambig".padStart(8),
  );
  for (const s of summary) {
    console.log(
      s.institutionCode.padEnd(14) +
        s.accountLabel.slice(s.institutionCode.length + 1).padEnd(20) +
        String(s.groups).padStart(8) +
        String(s.chronological).padStart(8) +
        String(s.reversed).padStart(10) +
        String(s.ambiguous).padStart(8),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
