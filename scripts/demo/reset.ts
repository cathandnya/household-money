// DB を全クリア → マイグレーション再適用 → 機関マスタ・カテゴリ再投入
//
// 危険操作なので本番環境ではブロックし、TTY からは確認プロンプトを出す。
// `--yes` フラグで確認スキップ可能。
import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

if (process.env.NODE_ENV === "production") {
  console.error("❌ NODE_ENV=production では実行できません");
  process.exit(1);
}

// tsx の cjs/esm 両方に対応 (import.meta.dirname は環境依存)
const here = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

const dbUrl = process.env.DATABASE_URL ?? "file:./data/money.db";
const filePath = dbUrl.replace(/^file:/, "");
// .env の DATABASE_URL は project root からの相対パスを採用 (`./data/money.db`)。
const dbAbsolute = path.isAbsolute(filePath)
  ? filePath
  : path.resolve(root, filePath);

async function confirm(): Promise<boolean> {
  if (process.argv.includes("--yes") || process.argv.includes("-y")) return true;
  if (!process.stdin.isTTY) {
    console.error("❌ TTY ではありません。--yes を付けて実行してください。");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer: string = await new Promise((resolve) =>
    rl.question(
      `⚠ DB ファイル (${dbAbsolute}) を削除して再構築します。続行する場合は Y を入力: `,
      resolve,
    ),
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

async function main() {
  if (!(await confirm())) {
    console.log("中止しました。");
    process.exit(0);
  }

  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    const p = dbAbsolute + suffix;
    if (existsSync(p)) {
      unlinkSync(p);
      console.log(`🗑  removed ${p}`);
    }
  }

  console.log("🚧 prisma migrate deploy …");
  execSync("npx prisma migrate deploy", { cwd: root, stdio: "inherit" });

  console.log("🌱 seed (機関マスタ・カテゴリ) …");
  execSync("npx tsx prisma/seed.ts", { cwd: root, stdio: "inherit" });

  console.log("✅ DB を初期状態に戻しました");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
