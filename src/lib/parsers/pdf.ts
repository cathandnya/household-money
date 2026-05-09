import path from "node:path";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
// Worker モジュールを静的 import して global にセットすることで、
// pdfjs の動的 import (Next.js のバンドラと相性が悪い) を回避し
// 同期的にメインスレッドで処理させる。
// @ts-expect-error pdf.worker.mjs は型情報を持たない
import * as pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs";

if (typeof globalThis !== "undefined" && !(globalThis as any).pdfjsWorker) {
  (globalThis as any).pdfjsWorker = pdfWorker;
}

// pdfjs は cMap や標準フォントを fetch() で取得しようとするが、Node.js の global fetch
// は file:// プロトコルをサポートしないため失敗する。fetch をラップして file URL を
// fs から読むようにする。
if (typeof globalThis !== "undefined" && !(globalThis as any).__pdfjsFileFetchPatched) {
  (globalThis as any).__pdfjsFileFetchPatched = true;
  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (typeof url === "string" && url.startsWith("file://")) {
      const filePath = decodeURIComponent(url.replace(/^file:\/\//, ""));
      const buf = await readFile(filePath);
      return new Response(buf);
    }
    return origFetch(input, init);
  }) as typeof fetch;
}

// CJK フォントを正しく扱うために pdfjs に cmaps と standard_fonts のパスを渡す。
// Next.js のバンドルから外れたパスにアクセスするため、createRequire でパッケージの
// 実体を解決する。
// Node.js では pdfjs の fetch ベースの cMap/標準フォント読み込みが効かないので、
// 自前のファクトリでローカルファイルを読む。
function makeNodeFactories() {
  const cMapDir = path.resolve(process.cwd(), "node_modules/pdfjs-dist/cmaps");
  const fontDir = path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts");

  // pdfjs v4+: { CMapReaderFactory, StandardFontDataFactory } をコンストラクタとして渡す形式
  class NodeCMapReaderFactory {
    async fetch({ name }: { name: string }) {
      const buf = await readFile(path.join(cMapDir, `${name}.bcmap`));
      return { cMapData: new Uint8Array(buf), isCompressed: true };
    }
  }
  class NodeStandardFontDataFactory {
    async fetch({ filename }: { filename: string }) {
      const buf = await readFile(path.join(fontDir, filename));
      return new Uint8Array(buf);
    }
  }
  return { NodeCMapReaderFactory, NodeStandardFontDataFactory };
}

const { NodeCMapReaderFactory, NodeStandardFontDataFactory } = makeNodeFactories();

export type PdfTextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
  pageNum: number;
};

export async function extractPdfItems(buf: Buffer): Promise<PdfTextItem[]> {
  // pdfjs の Node.js 環境では cMapUrl/standardFontDataUrl をローカルファイルシステム
  // パスとして直接渡すと、内部の NodeCMapReaderFactory 等が fs.readFile で読み込む。
  // file:// URL を渡すと WorkerMain 側の fetch ロジックが起動して file プロトコルが
  // 扱えずに失敗する。
  const cMapUrl = path.resolve(process.cwd(), "node_modules/pdfjs-dist/cmaps") + path.sep;
  const standardFontDataUrl =
    path.resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts") + path.sep;

  const pdf = await getDocument({
    data: new Uint8Array(buf),
    useSystemFonts: false,
    isEvalSupported: false,
    disableFontFace: true,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
    CMapReaderFactory: NodeCMapReaderFactory,
    StandardFontDataFactory: NodeStandardFontDataFactory,
  } as any).promise;

  const out: PdfTextItem[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const it of content.items as Array<{
      str: string;
      transform: number[];
      width?: number;
    }>) {
      if (!it.str) continue;
      out.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        width: it.width ?? 0,
        pageNum: p,
      });
    }
  }
  return out;
}

export function groupByLine(items: PdfTextItem[], yTolerance = 2): PdfTextItem[][] {
  const sorted = [...items].sort((a, b) => {
    if (a.pageNum !== b.pageNum) return a.pageNum - b.pageNum;
    if (Math.abs(a.y - b.y) > yTolerance) return b.y - a.y;
    return a.x - b.x;
  });
  const lines: PdfTextItem[][] = [];
  let cur: PdfTextItem[] = [];
  let curY: number | null = null;
  let curPage: number | null = null;
  for (const it of sorted) {
    if (
      curY !== null &&
      curPage === it.pageNum &&
      Math.abs(it.y - curY) <= yTolerance
    ) {
      cur.push(it);
    } else {
      if (cur.length) lines.push(cur);
      cur = [it];
      curY = it.y;
      curPage = it.pageNum;
    }
  }
  if (cur.length) lines.push(cur);
  return lines;
}
