/**
 * 文件读写、草稿会话与资源定位。
 * 桌面（Tauri）环境：通过 dialog/fs 插件读写真实文件；
 * 浏览器环境：降级为仅 localStorage 草稿。
 */
import { getCurrentWindow } from "@tauri-apps/api/window";
import { i18n } from "./i18n.svelte";

export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/* ---------- 草稿（v2：多标签） ---------- */

const DRAFT_KEY = "md66.draft.v2";

export interface DraftTab {
  path: string | null;
  content: string;
}

export interface Draft {
  activeId?: string;
  tabs: DraftTab[];
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return migrateV1();
    const draft = JSON.parse(raw) as Partial<Draft>;
    if (!Array.isArray(draft.tabs)) return null;
    const tabs = draft.tabs
      .filter((t): t is DraftTab => typeof t?.content === "string")
      .map((t) => ({ path: typeof t.path === "string" ? t.path : null, content: t.content }));
    if (tabs.length === 0) return null;
    return { activeId: draft.activeId, tabs };
  } catch {
    return null;
  }
}

/** 兼容 v1 单文件草稿 */
function migrateV1(): Draft | null {
  try {
    const raw = localStorage.getItem("md66.draft.v1");
    if (!raw) return null;
    const old = JSON.parse(raw) as { path?: string | null; content?: string };
    if (typeof old.content !== "string") return null;
    return { tabs: [{ path: old.path ?? null, content: old.content }] };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // 隐私模式等写入失败时静默忽略
  }
}

/* ---------- 文件对话框与读写 ---------- */

/** 编辑器支持的所有纯文本文件扩展名（无点号、小写） */
export const TEXT_EXTENSIONS = [
  "md", "markdown", "mdown", "mkd", "mkdn", "mdwn", "mdx",
  "txt", "text", "rtf",
  "rst", "org", "wiki", "adoc", "asciidoc",
  "html", "htm", "xml", "csv", "tsv",
  "json", "yaml", "yml", "toml", "ini", "cfg", "conf", "properties",
  "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "py", "rb", "java", "c", "h", "cpp", "hpp", "cs", "go", "rs", "swift", "kt", "php", "sh", "bash", "zsh", "ps1",
  "css", "scss", "sass", "less",
  "sql", "graphql", "gql",
  "log", "env", "gitignore", "dockerignore",
];

/** 文件对话框过滤器（名称随界面语言本地化） */
function mdFilters() {
  return [
    { name: i18n.t.file.filterMd, extensions: TEXT_EXTENSIONS },
    { name: i18n.t.file.filterAll, extensions: ["*"] },
  ];
}

/** 打开文件选择框，返回所选路径；取消返回 null */
export async function openFileDialog(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const path = await open({
    multiple: false,
    directory: false,
    filters: mdFilters(),
  });
  return typeof path === "string" ? path : null;
}

/** 另存为选择框，返回目标路径；取消返回 null */
export async function saveAsDialog(defaultName: string): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return await save({ filters: mdFilters(), defaultPath: defaultName });
}

/** 图片导出选择框 */
export async function saveBinaryDialog(
  defaultName: string,
  extensions: string[],
): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  return await save({
    filters: [{ name: extensions.join("/"), extensions }],
    defaultPath: defaultName,
  });
}

export async function readMarkdown(path: string): Promise<string> {
  const { readTextFile } = await import("@tauri-apps/plugin-fs");
  return await readTextFile(path);
}

export async function writeMarkdown(path: string, content: string): Promise<void> {
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(path, content);
}

export async function writeBinary(path: string, data: Uint8Array): Promise<void> {
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path, data);
}

/**
 * 将图片数据保存到 markdown 文件旁的 assets 目录，
 * 返回可写入 markdown 的相对引用（如 assets/xxx.png）。失败返回 null。
 */
export async function saveImageAsset(
  fileDir: string,
  ext: string,
  data: Uint8Array,
): Promise<string | null> {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rel = `assets/${stamp}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const abs = joinPath(fileDir, rel);
  await writeBinary(abs, data);
  return rel;
}

/** 读取本地文件为二进制（粘贴图片、拖拽文件用） */
export async function readBinary(path: string): Promise<Uint8Array> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  return await readFile(path);
}

/* ---------- 路径工具（兼容 macOS / Windows 分隔符） ---------- */

export function basename(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function dirname(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx >= 0 ? path.slice(0, idx) : "";
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  return `${dir.replace(/[\\/]+$/, "")}/${name}`;
}

/** markdown 相对路径 -> 本地文件路径（baseDir 为 md 文件所在目录） */
export function resolveRelative(baseDir: string, ref: string): string {
  if (!baseDir || /^[a-z]+:/i.test(ref) || ref.startsWith("/")) return ref;
  return joinPath(baseDir, ref);
}

/* ---------- 窗口 ---------- */

export async function setWindowTitle(title: string): Promise<void> {
  try {
    await getCurrentWindow().setTitle(title);
  } catch {
    // 非 Tauri 环境忽略
  }
}
