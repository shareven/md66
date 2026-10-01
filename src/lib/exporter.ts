/**
 * 导出：PDF（A4 分页直接生成）、Word（HTML 格式 .doc）、PNG 长图。
 * 依赖 Vditor 的静态渲染能力（资源已本地化）。
 */
import Vditor from "vditor";
import { basename, isTauri, saveBinaryDialog, writeMarkdown } from "./fileService";
import { i18n } from "./i18n.svelte";

const CDN = `${location.origin}/vditor`;

/* ---------- PDF：A4 分页，直接生成文件（系统 webview 不支持 window.print） ---------- */

const A4_PT_W = 595.28;
const A4_PT_H = 841.89;

interface PdfPage {
  jpeg: Uint8Array;
  wPx: number;
  hPx: number;
}

/** 用极简对象组装 PDF（每页一张 JPEG 图片，DCTDecode 直嵌无需压缩库） */
function buildPdf(pages: PdfPage[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = []; // 与对象编号 1..N 顺序对应
  let length = 0;
  const push = (chunk: string | Uint8Array): void => {
    const b = typeof chunk === "string" ? enc.encode(chunk) : chunk;
    parts.push(b);
    length += b.length;
  };

  push("%PDF-1.4\n");
  const n = pages.length;
  offsets.push(length);
  push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  offsets.push(length);
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ");
  push(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${n} >>\nendobj\n`);
  pages.forEach((p, i) => {
    const pageNum = 3 + i * 3;
    const imgNum = pageNum + 1;
    const contNum = pageNum + 2;
    offsets.push(length);
    push(
      `${pageNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_PT_W} ${A4_PT_H}] ` +
        `/Resources << /XObject << /Im0 ${imgNum} 0 R >> >> /Contents ${contNum} 0 R >>\nendobj\n`,
    );
    offsets.push(length);
    push(
      `${imgNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.wPx} /Height ${p.hPx} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    push(p.jpeg);
    push("\nendstream\nendobj\n");
    offsets.push(length);
    const content = `q ${A4_PT_W} 0 0 ${A4_PT_H} 0 0 cm /Im0 Do Q\n`;
    push(
      `${contNum} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`,
    );
  });

  const xrefOff = length;
  const size = 3 + n * 3;
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let pos = 0;
  for (const b of parts) {
    out.set(b, pos);
    pos += b.length;
  }
  return out;
}

/** 离屏按 A4 宽度（794px @96dpi）浅色渲染，再按 A4 比例切片分页 */
async function renderA4Pages(markdown: string): Promise<PdfPage[]> {
  const { default: html2canvas } = await import("html2canvas");
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;padding:44px 48px;z-index:-1;";
  document.body.appendChild(host);

  try {
    await Vditor.preview(host, markdown, {
      cdn: CDN,
      mode: "light",
      theme: { current: "light" },
      hljs: { style: "github", lineNumber: false },
      speech: { enable: false },
    });
    await new Promise((r) => setTimeout(r, 500));

    const canvas = await html2canvas(host, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const scale = canvas.width / 794;
    const pageH = Math.round(1123 * scale);
    const pageCount = Math.max(1, Math.ceil(canvas.height / pageH));
    const pages: PdfPage[] = [];
    for (let i = 0; i < pageCount; i++) {
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = pageH;
      const ctx = slice.getContext("2d");
      if (!ctx) throw new Error(i18n.t.exporter.screenshotFailed);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, -i * pageH);
      const dataUrl = slice.toDataURL("image/jpeg", 0.92);
      const bin = atob(dataUrl.slice(dataUrl.indexOf(",") + 1));
      const jpeg = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) jpeg[j] = bin.charCodeAt(j);
      pages.push({ jpeg, wPx: slice.width, hPx: slice.height });
    }
    return pages;
  } finally {
    host.remove();
  }
}

/** 导出 PDF（A4 分页直接写文件） */
export async function exportPdf(markdown: string, srcPath: string | null): Promise<void> {
  if (!isTauri) throw new Error(i18n.t.exporter.desktopOnly);
  const pages = await renderA4Pages(markdown);
  const path = await saveBinaryDialog(fallbackName(srcPath, "pdf"), ["pdf"]);
  if (!path) return;
  const { writeBinary } = await import("./fileService");
  await writeBinary(path, buildPdf(pages));
}

function fallbackName(path: string | null, ext: string): string {
  const base = path ? basename(path).replace(/\.[^.]+$/, "") : i18n.t.common.unnamed;
  return `${base}.${ext}`;
}

/** 打印（跨平台）：
 *  - 浏览器 / Windows（WebView2 支持 window.print）→ 系统打印对话框
 *  - macOS WKWebView / Linux WebKitGTK 均未实现 window.print()，
 *    落一份 A4 PDF 到临时目录并用系统默认查看器打开，在其中打印
 *  返回提示文案；null 表示已走系统对话框，无需提示。 */
export async function printDocument(
  markdown: string,
  srcPath: string | null,
): Promise<string | null> {
  if (!isTauri || /Windows/i.test(navigator.userAgent)) {
    window.print();
    return null;
  }
  const pages = await renderA4Pages(markdown);
  const { tempDir, join } = await import("@tauri-apps/api/path");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const { openPath } = await import("@tauri-apps/plugin-opener");
  const dest = await join(await tempDir(), fallbackName(srcPath, "pdf"));
  await writeFile(dest, buildPdf(pages));
  await openPath(dest);
  return i18n.t.page.printOpened;
}

/** 导出 Word（.doc，HTML 格式，Word/WPS 可直接打开编辑） */
export async function exportWord(markdown: string, srcPath: string | null): Promise<void> {
  if (!isTauri) throw new Error(i18n.t.exporter.desktopOnly);
  const html = await Vditor.md2html(markdown, {
    cdn: CDN,
    mode: "light",
    theme: { current: "light" },
    hljs: { style: "github", lineNumber: false },
  });
  const doc = `<!doctype html>
<html><head><meta charset="utf-8"><title>${fallbackName(srcPath, "doc")}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.7; }
  pre { background: #f6f6f6; padding: 10px; overflow-x: auto; }
  code { font-family: Menlo, Consolas, monospace; }
  table { border-collapse: collapse; } th, td { border: 1px solid #999; padding: 6px 10px; }
  img { max-width: 100%; }
</style></head><body>${html}</body></html>`;

  const path = await saveBinaryDialog(fallbackName(srcPath, "doc"), ["doc"]);
  if (!path) return;
  await writeMarkdown(path, doc);
}

/** 导出 PNG 长图（离屏渲染后截图） */
export async function exportImage(
  markdown: string,
  srcPath: string | null,
  dark: boolean,
): Promise<void> {
  if (!isTauri) throw new Error(i18n.t.exporter.desktopOnly);
  const { default: html2canvas } = await import("html2canvas");

  // 离屏渲染容器
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;background:#ffffff;padding:40px 48px;z-index:-1;";
  document.body.appendChild(host);

  try {
    await Vditor.preview(host, markdown, {
      cdn: CDN,
      mode: "dark",
      theme: { current: dark ? "dark" : "light" },
      hljs: { style: dark ? "github-dark" : "github", lineNumber: false },
      speech: { enable: false },
    });
    // 等待内嵌资源（图片/字体）就绪
    await new Promise((r) => setTimeout(r, 500));

    const canvas = await html2canvas(host, {
      backgroundColor: dark ? "#1e2023" : "#ffffff",
      scale: 2,
      useCORS: true,
    });
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error(i18n.t.exporter.screenshotFailed);

    const path = await saveBinaryDialog(fallbackName(srcPath, "png"), ["png"]);
    if (!path) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const { writeBinary } = await import("./fileService");
    await writeBinary(path, buf);
  } finally {
    host.remove();
  }
}
