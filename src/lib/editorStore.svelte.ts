/**
 * 全局编辑器状态（多标签、模式、主题、字号、面板开关）。
 * 状态放模块级单例，路由切换（语法说明/关于页）不丢失编辑现场。
 */
import { basename, isTauri, loadDraft, saveDraft } from "./fileService";
import { i18n } from "./i18n.svelte";

export type Mode = "preview" | "source";

export interface Tab {
  id: string;
  /** 关联文件路径；null = 未命名 */
  path: string | null;
  /** 当前内容 */
  content: string;
  /** 最近一次持久化（写盘/写草稿）的内容 */
  saved: string;
  /** 最近已知磁盘内容（外部修改检测）；null = 未读取 */
  disk: string | null;
}

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createTab(init?: Partial<Tab>): Tab {
  return {
    id: newId(),
    path: null,
    content: "",
    saved: "",
    disk: null,
    ...init,
  };
}

const WELCOME_MD_ZH = `# 欢迎使用 md66

一款**启动快、加载快**的开源免费跨平台 Markdown 编辑器，支持 **macOS**、**Windows** 和 **Linux**。

## 双模式编辑

- **预览模式**：即时渲染，直接在排版后的文本上编辑
- **源码模式**：编辑原始 Markdown 文本，带语法高亮

两种模式编辑的内容实时互通，按 <kbd>⌘/</kbd>（Windows 为 <kbd>Ctrl+/</kbd>）即可切换。

## 文件与保存

- <kbd>⌘O</kbd> 打开，<kbd>⌘S</kbd> 保存，<kbd>⌘⇧S</kbd> 另存为，<kbd>⌘T</kbd> 新标签
- 关联文件后修改会**自动保存**；未关联时自动保存为草稿，重启恢复
- 粘贴或拖入图片会存到文件旁的 \`assets/\` 目录

\`\`\`ts
const hello = (name: string) => \`你好，\${name}！\`;
\`\`\`

| 功能 | 状态 |
| ---- | ---- |
| 双模式编辑 | 已支持 |
| 自动保存 / 草稿恢复 | 已支持 |
| 打开 / 保存文件 | 已支持 |
| 大纲 / 查找替换 | 已支持 |
| 导出 PDF / Word / 图片 | 已支持 |
`;

const WELCOME_MD_EN = `# Welcome to md66

A Markdown editor for **macOS**, **Windows**, and **Linux**.

## Dual-mode editing

- **Preview mode**: live rendering — edit directly on the formatted text
- **Source mode**: edit raw Markdown with syntax highlighting

Both modes stay in sync; press <kbd>⌘/</kbd> (<kbd>Ctrl+/</kbd> on Windows) to switch.

## Files & saving

- <kbd>⌘O</kbd> open, <kbd>⌘S</kbd> save, <kbd>⌘⇧S</kbd> save as, <kbd>⌘T</kbd> new tab
- Linked files **auto-save** on change; otherwise changes are kept as a draft and restored on restart
- Pasted or dropped images go to an \`assets/\` folder next to the file

\`\`\`ts
const hello = (name: string) => \`Hello, \${name}!\`;
\`\`\`

| Feature | Status |
| ---- | ---- |
| Dual-mode editing | Ready |
| Auto-save / draft restore | Ready |
| Open / save files | Ready |
| Outline / find & replace | Ready |
| Export PDF / Word / image | Ready |
`;

/** 两种语言的欢迎文档（isWelcome 需同时识别，避免切语言后误判为普通文档） */
const WELCOME_DOCS = [WELCOME_MD_ZH, WELCOME_MD_EN];

function welcomeMd(): string {
  return i18n.lang === "zh" ? WELCOME_MD_ZH : WELCOME_MD_EN;
}

/** 欢迎页标签：未关联文件且内容未被改过 */
function isWelcome(tab: Tab): boolean {
  return !tab.path && WELCOME_DOCS.includes(tab.content);
}

class EditorStore {
  tabs = $state<Tab[]>([]);
  activeId = $state("");
  mode = $state<Mode>("preview");
  /** 构造时立即同步系统深浅色：冷启动首个标签的主题必须一步到位，
   *  若先按默认亮色初始化再动态切换，Vditor 会出现深灰底黑字的中间态 */
  dark = $state(
    typeof window !== "undefined" &&
      !!window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );
  /** 编辑区字号（12–28px） */
  fontPx = $state(16);
  /** 自动保存开关（文件菜单勾选切换，重启记忆；关闭后靠 ⌘S 手动保存） */
  autoSave = $state(true);
  outlineOpen = $state(false);
  findOpen = $state(false);
  paletteOpen = $state(false);
  recents = $state<string[]>([]);
  statusMsg = $state("");

  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** 编辑器实例注入的"在光标处插入"方法（键：模式） */
  inserters = $state<Record<string, ((text: string) => void) | undefined>>({});
  /** CodeMirror 视图引用（源码模式定位/查找用） */
  cmView: unknown = null;

  constructor() {
    this.fontPx = clampFont(loadNumber("md66.fontPx", 16));
    this.autoSave = loadBool("md66.autoSave", true);
    this.recents = loadRecents();
    this.restoreSession();
  }

  get active(): Tab | undefined {
    return this.tabs.find((t) => t.id === this.activeId);
  }

  get dirtyCount(): number {
    return this.tabs.filter((t) => t.content !== t.saved).length;
  }

  flash(msg: string) {
    this.statusMsg = msg;
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => (this.statusMsg = ""), 2000);
  }

  /* ---------- 文件打开 / 保存 ---------- */

  /** 打开指定路径：已在标签中则激活并刷新，否则新建标签 */
  async openPath(path: string): Promise<void> {
    try {
      const { readMarkdown } = await import("./fileService");
      const content = await readMarkdown(path);
      const existing = this.tabs.find((t) => t.path === path);
      if (existing) {
        existing.content = content;
        existing.saved = content;
        existing.disk = content;
        this.activeId = existing.id;
      } else {
        const tab = createTab({ path, content, saved: content, disk: content });
        this.tabs.push(tab);
        this.activeId = tab.id;
      }
      // 打开了真实文件，未修改的欢迎页标签就不再需要
      this.tabs = this.tabs.filter((t) => !isWelcome(t));
      this.pushRecent(path);
      this.persistDraft();
      this.flash(i18n.t.store.opened(basename(path)));
    } catch {
      this.flash(i18n.t.store.openFailed);
    }
  }

  /** 打开文件选择框 */
  async openFilePicker(): Promise<void> {
    if (!isTauri) return this.flash(i18n.t.store.desktopOnly);
    const { openFileDialog } = await import("./fileService");
    const path = await openFileDialog();
    if (path) await this.openPath(path);
  }

  /** 保存当前标签；未关联文件时走另存为 */
  async saveActive(): Promise<void> {
    const tab = this.active;
    if (!tab) return;
    if (!isTauri) return this.flash(i18n.t.store.desktopOnly);
    if (!tab.path) return this.saveActiveAs();
    try {
      const { writeMarkdown } = await import("./fileService");
      await writeMarkdown(tab.path, tab.content);
      tab.disk = tab.content;
      tab.saved = tab.content;
      this.pushRecent(tab.path);
      this.persistDraft();
      this.flash(i18n.t.store.saved);
    } catch {
      this.flash(i18n.t.store.saveFailed);
    }
  }

  /** 另存为当前标签 */
  async saveActiveAs(): Promise<void> {
    const tab = this.active;
    if (!tab) return;
    if (!isTauri) return this.flash(i18n.t.store.desktopOnly);
    try {
      const { saveAsDialog, writeMarkdown, TEXT_EXTENSIONS } = await import("./fileService");
      const name = tab.path ? basename(tab.path) : i18n.t.store.unnamedMd;
      // 如果当前文件名已带受支持扩展名，保留原名；否则默认补 .md
      const hasSupportedExt = new RegExp(
        `\\.(${TEXT_EXTENSIONS.join("|")})$`, "i",
      ).test(name);
      const path = await saveAsDialog(hasSupportedExt ? name : `${name}.md`);
      if (!path) return;
      await writeMarkdown(path, tab.content);
      tab.path = path;
      tab.disk = tab.content;
      tab.saved = tab.content;
      this.pushRecent(path);
      this.persistDraft();
      this.flash(i18n.t.store.savedTo(basename(path)));
    } catch {
      this.flash(i18n.t.store.saveFailed);
    }
  }

  /** 保存所有有未保存修改的标签（关闭窗口前） */
  async saveAllDirty(): Promise<void> {
    for (const tab of this.tabs) {
      if (tab.content === tab.saved || !tab.path) continue;
      try {
        const { writeMarkdown } = await import("./fileService");
        await writeMarkdown(tab.path, tab.content);
        tab.disk = tab.content;
        tab.saved = tab.content;
      } catch {
        /* 尽力保存 */
      }
    }
    this.persistDraft();
  }

  /** 在光标处插入文本（图片粘贴 / TOC 等使用） */
  insertToActive(text: string) {
    this.inserters[this.mode]?.(text);
  }

  /* ---------- 标签 ---------- */

  openBlankTab(content = welcomeMd(), activate = true): Tab {
    const tab = createTab({ content, saved: content });
    this.tabs.push(tab);
    if (activate) this.activeId = tab.id;
    this.persistDraft();
    return tab;
  }

  async closeTab(id: string): Promise<boolean> {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return false;
    const tab = this.tabs[idx];
    if (tab.content !== tab.saved && !(await confirmDiscard(tab))) return false;
    this.tabs.splice(idx, 1);
    if (this.tabs.length === 0) {
      this.openBlankTab("");
      return true;
    }
    if (this.activeId === id) {
      this.activeId = this.tabs[Math.min(idx, this.tabs.length - 1)].id;
    }
    this.persistDraft();
    return true;
  }

  activate(id: string) {
    if (this.tabs.some((t) => t.id === id)) this.activeId = id;
  }

  /* ---------- 会话草稿（v2：多标签） ---------- */

  restoreSession() {
    const draft = loadDraft();
    // 兼容旧草稿：欢迎页标签不恢复（两种语言的欢迎文档都识别）
    const restored =
      draft?.tabs.filter((t) => t.path || !WELCOME_DOCS.includes(t.content)) ?? [];
    if (restored.length > 0) {
      this.tabs = restored.map((t) =>
        createTab({ path: t.path ?? null, content: t.content, saved: t.content }),
      );
      this.activeId =
        this.tabs.find((t) => t.id === draft!.activeId)?.id ?? this.tabs[0].id;
    } else if (this.recents.length === 0) {
      // 首次使用才展示欢迎页；老用户给空白页
      this.openBlankTab();
    } else {
      this.openBlankTab("");
    }
  }

  persistDraft() {
    if (this.tabs.length === 0) return;
    // 欢迎页不持久化，避免下次启动又弹出来
    const tabs = this.tabs.filter((t) => !isWelcome(t));
    saveDraft({
      activeId: this.activeId,
      tabs: tabs.map((t) => ({ path: t.path, content: t.content })),
    });
  }

  /* ---------- 自动保存 ---------- */

  /** 文件菜单勾选项：切换自动保存；重新开启时立即落盘已有修改 */
  toggleAutoSave() {
    this.autoSave = !this.autoSave;
    saveBool("md66.autoSave", this.autoSave);
    this.flash(this.autoSave ? i18n.t.store.autoSaveOn : i18n.t.store.autoSaveOff);
    if (this.autoSave) this.scheduleAutoSave();
  }

  /** 内容变化后调用：防抖 800ms 写盘所有有修改的标签 + 更新草稿 */
  scheduleAutoSave() {
    if (!this.autoSave) return; // 关闭时不写盘不标记，保留脏状态由 ⌘S 手动保存
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(async () => {
      const dirty = this.tabs.filter((t) => t.content !== t.saved);
      if (dirty.length === 0) return;
      try {
        if (isTauri) {
          const { writeMarkdown } = await import("./fileService");
          for (const tab of dirty) {
            if (!tab.path) continue;
            await writeMarkdown(tab.path, tab.content);
            tab.disk = tab.content;
          }
        }
        // 无关联文件的标签：写入草稿持久化即可视为已保存
        for (const tab of dirty) tab.saved = tab.content;
        this.persistDraft();
      } catch {
        this.flash(i18n.t.store.autoSaveFailed);
      }
    }, 800);
  }

  /* ---------- 最近文件 ---------- */

  pushRecent(path: string) {
    this.recents = [path, ...this.recents.filter((p) => p !== path)].slice(0, 10);
    saveRecents(this.recents);
  }

  /* ---------- 编辑器注入 ---------- */

  /** 编辑区字号缩放；reset 为 true 恢复 16px */
  zoomFont(delta: number, reset = false) {
    this.fontPx = clampFont(reset ? 16 : this.fontPx + delta);
    saveNumber("md66.fontPx", this.fontPx);
  }
}

function clampFont(px: number): number {
  return Math.min(28, Math.max(12, Math.round(px)));
}

function loadNumber(key: string, fallback: number): number {
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

function loadBool(key: string, fallback: boolean): boolean {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v === "true";
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore */
  }
}

const RECENTS_KEY = "md66.recents.v1";

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function saveRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** 关闭标签前确认（有未保存修改时）。返回 false 表示取消关闭。 */
async function confirmDiscard(tab: Tab): Promise<boolean> {
  const name = tab.path ? basename(tab.path) : i18n.t.common.unnamed;
  if (!isTauri) return window.confirm(i18n.t.store.discardBrowser(name));
  const { ask } = await import("@tauri-apps/plugin-dialog");
  return ask(i18n.t.store.discardAsk(name), {
    title: "md66",
    kind: "warning",
  });
}

export const editor = new EditorStore();
