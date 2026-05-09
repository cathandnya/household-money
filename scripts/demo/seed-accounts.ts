// demo 用の架空口座を 1 機関 1 件ずつ作成する。
// 既存の Account に "デモ" プレフィックスで衝突しないよう upsert で冪等に。
import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "file:../data/money.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

type DemoAccount = {
  institutionCode: string;
  name: string;
  kind: string;
};

// 各機関に 1 件ずつ。MANUAL は性質上複数 (現金財布・Suica)。
const demoAccounts: DemoAccount[] = [
  { institutionCode: "rakuten_bank",       name: "デモ楽天銀行 普通預金",        kind: "CHECKING" },
  { institutionCode: "shinsei",            name: "デモ新生銀行 パワーフレックス", kind: "CHECKING" },
  { institutionCode: "resona",             name: "デモりそな 普通預金",          kind: "CHECKING" },
  { institutionCode: "yucho",              name: "デモゆうちょ 通常貯金",        kind: "CHECKING" },
  { institutionCode: "smcc",               name: "デモ三井住友カード",           kind: "CREDIT_CARD" },
  { institutionCode: "rakuten_card",       name: "デモ楽天カード",               kind: "CREDIT_CARD" },
  { institutionCode: "rakuten_sec",        name: "デモ楽天証券",                 kind: "BROKERAGE" },
  { institutionCode: "rakuten_sec_jnisa",  name: "デモ楽天証券 ジュニアNISA",    kind: "BROKERAGE" },
  { institutionCode: "sbi_benefit",        name: "デモSBIベネフィット DC",       kind: "DC" },
  { institutionCode: "manual",             name: "デモ現金財布",                 kind: "MANUAL" },
  { institutionCode: "manual",             name: "デモSuica",                    kind: "MANUAL" },
];

async function main() {
  let created = 0;
  let updated = 0;
  for (const def of demoAccounts) {
    const inst = await prisma.institution.findUnique({
      where: { code: def.institutionCode },
    });
    if (!inst) {
      console.warn(`⚠ 機関 ${def.institutionCode} が見つかりません (seed.ts 未実行?)`);
      continue;
    }
    const existing = await prisma.account.findUnique({
      where: { institutionId_name: { institutionId: inst.id, name: def.name } },
    });
    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { kind: def.kind },
      });
      updated++;
      console.log(`  (update) ${inst.name} / ${def.name}`);
    } else {
      await prisma.account.create({
        data: { institutionId: inst.id, name: def.name, kind: def.kind },
      });
      created++;
      console.log(`  (create) ${inst.name} / ${def.name}`);
    }
  }
  console.log(`✅ demo 口座: created=${created}, updated=${updated}, total=${demoAccounts.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
