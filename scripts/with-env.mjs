#!/usr/bin/env node
// .env を読んで process.env に流し込んでから渡されたコマンドを実行する小さなランチャ。
// `next dev` / `next start` 起動時に PORT/HOSTNAME を `.env` から効かせるため。
// (Next.js の CLI は `.env` を CLI 引数解釈前には読まないので Node プロセス起動時に
//  シェル環境変数として渡す必要があり、ユーザに `PORT=3001 npm run dev` を強制
//  しないために自前ラッパーを使う。)
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let value = m[2];
    // 両端のクォート除去
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

const envPath = path.join(root, ".env");
if (existsSync(envPath)) {
  const parsed = parseEnvFile(readFileSync(envPath, "utf8"));
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] == null) process.env[k] = v;
  }
}

const argv = process.argv.slice(2);
if (argv.length === 0) {
  console.error("usage: node scripts/with-env.mjs <command> [args...]");
  process.exit(1);
}
const [cmd, ...rest] = argv;

// next CLI は npm bin に居るのでローカル node_modules 内を解決する
const isNext = cmd === "next";
const exe = isNext
  ? path.join(root, "node_modules", "next", "dist", "bin", "next")
  : cmd;
const args = isNext ? rest : rest;

const child = isNext
  ? spawn(process.execPath, [exe, ...args], { stdio: "inherit", env: process.env })
  : spawn(exe, args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
