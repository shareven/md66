/**
 * 导出：PDF（打印对话框）、Word（HTML 格式 .doc）、PNG 长图。
 * 依赖 Vditor 的静态渲染能力（资源已本地化）。
 */
import Vditor from "vditor";
import { basename, isTauri, saveBinaryDialog, writeMarkdown } from "./fileService";

const CDN = `${location.origin}/vditor`;

function fallbackName(path: string | null, ext: string): string {
  const base = path ? basename(path).replace(/\.[^.]+$/, "") : "未命名";
  return `${base}.${ext}`;
}

/** 打印（系统对话框中选择"存储为 PDF"即可导出 PDF） */
export function printDocument(): void {
  window.print();
}

/** 导出 Word（.doc，HTML 格式，Word/WPS 可直接打开编辑） */
export async function exportWord(markdown: string, srcPath: string | null): Promise<void> {
  if (!isTauri) throw new Error("导出需在桌面应用中使用");
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
  if (!isTauri) throw new Error("导出需在桌面应用中使用");
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
    if (!blob) throw new Error("截图失败");

    const path = await saveBinaryDialog(fallbackName(srcPath, "png"), ["png"]);
    if (!path) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const { writeBinary } = await import("./fileService");
    await writeBinary(path, buf);
  } finally {
    host.remove();
  }
}
