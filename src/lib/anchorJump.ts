/**
 * 目录（TOC）与锚点链接的统一跳转。
 *
 * 实测发现的三个坑（这也是"点击没反应"的根因）：
 * 1. Vditor 每次渲染会给标题 id 追加 "_序号"（如 ir-章节_12），
 *    而 TOC 的 data-target-id 用的是不带后缀的旧 id，锚点 href 同理 —— 精确查找必然落空；
 * 2. Vditor 自带的点击处理滚的是 window 或 .vditor-ir，
 *    而应用实际滚动容器是内层的 pre.vditor-reset / .content；
 * 3. 静态渲染（语法说明页）默认 toc:false，[TOC] 会原样输出纯文本。
 *
 * 这里在容器捕获阶段统一接管：归一化匹配标题后 scrollIntoView，
 * 由浏览器滚动最近的可滚动祖先，编辑器 / 说明页行为一致。
 */

/** 剥离 Vditor 渲染附加的模式前缀与序号后缀，得到可比对的标题 id */
function normalizeId(raw: string): string {
  return raw.replace(/^(ir|wysiwyg|sv)-/, "").replace(/_\d+$/, "");
}

/** 按锚点定位标题：精确 id → 归一化 id → 标题文本 */
function findHeadingTarget(frag: string): HTMLElement | null {
  if (!frag) return null;
  const exact = document.getElementById(frag);
  if (exact) return exact;

  const norm = normalizeId(frag);
  const headings = document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6");
  for (const h of headings) {
    if (normalizeId(h.id) === norm) return h;
  }
  // id 方案对不上时按标题文字兜底（如中文锚点 [链接](#章节甲)）
  for (const h of headings) {
    if ((h.textContent ?? "").trim() === frag) return h;
  }
  return null;
}

/** 挂载在渲染容器捕获阶段（Svelte: onclickcapture） */
export function handleAnchorJump(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target || typeof target.closest !== "function") return;

  // 1. 目录条目：span[data-target-id]（Vditor 渲染的 TOC / 大纲）。
  //    条目文字是 span，点击落在父级 li/ul 留白处时 closest 命不中（属性在子元素上），
  //    需向下兜底取后代条目，否则"点了没反应"
  const tocItem =
    target.closest<HTMLElement>("[data-target-id]") ??
    target.querySelector<HTMLElement>("[data-target-id]");
  if (tocItem) {
    const frag = tocItem.getAttribute("data-target-id") ?? "";
    const el = findHeadingTarget(frag);
    if (el) {
      e.preventDefault();
      e.stopPropagation();
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  // 2. 锚点链接：<a href="#标题">（跳过 href="#"）
  const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
  if (!anchor) return;
  const href = anchor.getAttribute("href") ?? "";
  if (href.length < 2) return;

  let frag = href.slice(1);
  try {
    frag = decodeURIComponent(frag);
  } catch {
    // 非法转义序列时按原文匹配
  }

  const el = findHeadingTarget(frag);
  if (el) {
    e.preventDefault();
    e.stopPropagation();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
