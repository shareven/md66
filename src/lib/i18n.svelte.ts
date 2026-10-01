/**
 * 轻量 i18n：中文 / 英文双语言，自动跟随系统语言。
 * 状态放模块级单例（与 editorStore 相同模式），多窗口各自检测，结果一致。
 */
export type Lang = "zh" | "en";

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "zh";
  const langs =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];
  // 任意首选语言为中文（zh-CN / zh-TW / zh-HK …）即显示中文，其余一律英文
  for (const l of langs) {
    if (l && l.toLowerCase().startsWith("zh")) return "zh";
  }
  return "en";
}

/* 快捷键提示按平台自适应：macOS 用 ⌘/⇧，Windows / Linux 用 Ctrl/Shift */
const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const KMOD = isMac ? "⌘" : "Ctrl+";
const KSHIFT = isMac ? "⇧" : "Shift+";
const ZOOM_IN = isMac ? "⌘+" : "Ctrl+=";
const ZOOM_OUT = isMac ? "⌘-" : "Ctrl+-";

const zh = {
  common: {
    unnamed: "未命名",
    dateLocale: "zh-CN",
  },
  menu: {
    file: "文件",
    edit: "编辑",
    view: "视图",
    help: "帮助",
    newWindow: "新建窗口",
    newTab: "新建标签",
    open: "打开…",
    save: "保存",
    saveAs: "另存为…",
    autoSave: "自动保存",
    exportPdf: "导出 PDF…",
    exportWord: "导出 Word…",
    exportImage: "导出图片…",
    print: "打印…",
    closeTab: "关闭标签",
    findReplace: "查找替换…",
    insertToc: "插入目录（TOC）",
    insertDate: "插入当前日期",
    previewMode: "预览模式",
    sourceMode: "源码模式",
    outlinePanel: "大纲面板",
    zoomIn: "放大字体",
    zoomOut: "缩小字体",
    resetZoom: "重置字体",
    darkMode: "深色模式",
    guide: "Markdown 语法说明",
    palette: "命令面板",
    checkUpdate: "检查更新…",
    about: (name: string, ver: string) => `关于 ${name}（v${ver}）`,
  },
  header: {
    modeAria: "编辑模式",
    preview: "预览",
    source: "源码",
    previewTitle: "在渲染后的富文本界面上直接编辑",
    sourceTitle: "编辑原始 Markdown 文本",
    unsaved: "未保存…",
    toggleMode: (mod: string) => `${mod}/ 切换模式`,
    noFile: "未关联文件，修改会自动存为草稿",
  },
  tab: {
    close: "关闭标签",
    new: `新建标签 (${KMOD}T)`,
  },
  status: {
    words: (n: number) => `${n} 字`,
    chars: (n: number) => `${n} 字符`,
    lines: (n: number) => `${n} 行`,
    zoomOut: `缩小字体 (${ZOOM_OUT})`,
    fontSize: "编辑区字号",
    zoomIn: `放大字体 (${ZOOM_IN})`,
  },
  palette: {
    aria: "命令面板",
    placeholder: "输入命令名称…",
    empty: "无匹配命令",
  },
  find: {
    placeholder: "查找…",
    replacePlaceholder: "替换为…",
    zero: "0 处",
    mark: (n: number) => `第 ${n} 处`,
    prev: `上一处 (${KSHIFT}Enter)`,
    next: "下一处 (Enter)",
    replace: "替换",
    replaceTitle: "替换当前处 (替换框 Enter)",
    all: "全部",
    allTitle: "全部替换",
    close: "关闭 (Esc)",
    replacedOne: (i: number, total: number) => `已替换 ${i}/${total}`,
    replacedAll: (n: number) => `已替换 ${n} 处`,
  },
  outline: {
    title: "大纲",
    empty: "暂无标题",
  },
  update: {
    btn: (v: string) => `更新 v${v}`,
    btnTitle: (v: string) => `发现新版本 v${v}，点击从 GitHub 下载并安装`,
    downloading: (p: number) => `下载中 ${p}%`,
    checking: "检查更新…",
    upToDate: "已是最新版本",
    checkFailed: "检查更新失败",
    opened: "已下载，正在打开安装包…",
    revealed: "已下载到“下载”文件夹，请在文件管理器中完成安装",
    fallback: "下载失败，已打开发布页，请手动下载",
  },
  store: {
    opened: (name: string) => `已打开 ${name}`,
    openFailed: "打开文件失败",
    desktopOnly: "文件功能需在桌面应用中使用（yarn tauri dev）",
    multiWindow: "多窗口需在桌面应用中使用",
    saved: "已保存",
    saveFailed: "保存失败",
    savedTo: (name: string) => `已保存到 ${name}`,
    unnamedMd: "未命名.md",
    autoSaveOn: "已开启自动保存",
    autoSaveOff: "已关闭自动保存",
    autoSaveFailed: "自动保存失败",
    discardBrowser: (name: string) => `放弃对「${name}」的未保存修改？`,
    discardAsk: (name: string) => `「${name}」有未保存的修改，确定放弃吗？`,
  },
  page: {
    tocInserted: "已插入目录标记",
    exportedWord: "已导出 Word",
    exportedImage: "已导出图片",
    exportedPdf: "已导出 PDF",
    printOpened: "已生成 PDF 并用系统查看器打开，可在其中打印",
    generating: "正在生成图片…",
    generatingPdf: "正在生成 PDF…",
    exportFailed: "导出失败",
    saveFirst: "请先保存文件后再插入图片",
    imageAlt: "图片",
    imageInserted: "图片已插入",
    imageSaveFailed: "图片保存失败",
    imageInsertFailed: "图片插入失败",
    externalReloaded: (name: string) => `「${name}」已被外部修改，已重新加载`,
    externalAsk: (name: string) =>
      `「${name}」已被其他程序修改，重新加载吗？本地未保存的修改将丢失。`,
    closeConfirm: (n: number) => `${n} 个标签有未保存的修改，关闭前保存吗？`,
  },
  exporter: {
    desktopOnly: "导出需在桌面应用中使用",
    screenshotFailed: "截图失败",
  },
  file: {
    filterMd: "Markdown / 文本",
    filterAll: "所有文件",
  },
  guide: {
    back: "‹ 返回编辑器",
    title: "Markdown 语法说明",
  },
  about: {
    back: "‹ 返回编辑器",
    title: "关于",
    logoAlt: (name: string) => `${name} 图标`,
    version: (v: string) => `版本 ${v}`,
    tagline: "启动快 · 加载快 · 体积小",
    desc1: "原生内核（Tauri 2 + Rust）：冷启动仅约 0.3 秒，大文件即点即开。",
    desc2: "预览模式即时渲染、所见即所得；源码模式轻快纯粹。",
    speed1: "⚡ 冷启动 ~0.3 秒",
    speed2: "📄 大文件即点即开",
    speed3: "📦 安装包仅 ~11 MB",
    privacy: "🔒 隐私承诺：不收集任何个人信息，联网仅用于访问 GitHub Release 下载更新",
    checkUpdate: "检查更新",
    install: (v: string) => `下载并安装 v${v}`,
    license: "MIT License · 基于 Tauri / Svelte / Vditor / CodeMirror",
  },
};

export type Dict = typeof zh;

const en: Dict = {
  common: {
    unnamed: "Untitled",
    dateLocale: "en-US",
  },
  menu: {
    file: "File",
    edit: "Edit",
    view: "View",
    help: "Help",
    newWindow: "New Window",
    newTab: "New Tab",
    open: "Open…",
    save: "Save",
    saveAs: "Save As…",
    autoSave: "Auto Save",
    exportPdf: "Export PDF…",
    exportWord: "Export Word…",
    exportImage: "Export Image…",
    print: "Print…",
    closeTab: "Close Tab",
    findReplace: "Find & Replace…",
    insertToc: "Insert Table of Contents (TOC)",
    insertDate: "Insert Today's Date",
    previewMode: "Preview Mode",
    sourceMode: "Source Mode",
    outlinePanel: "Outline Panel",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    resetZoom: "Reset Font Size",
    darkMode: "Dark Mode",
    guide: "Markdown Syntax Guide",
    palette: "Command Palette",
    checkUpdate: "Check for Updates…",
    about: (name: string, ver: string) => `About ${name} (v${ver})`,
  },
  header: {
    modeAria: "Edit mode",
    preview: "Preview",
    source: "Source",
    previewTitle: "Edit directly on the rendered rich text",
    sourceTitle: "Edit raw Markdown text",
    unsaved: "Unsaved…",
    toggleMode: (mod: string) => `${mod}/ toggle mode`,
    noFile: "No file linked; changes are auto-saved as a draft",
  },
  tab: {
    close: "Close tab",
    new: `New tab (${KMOD}T)`,
  },
  status: {
    words: (n: number) => (n === 1 ? "1 word" : `${n} words`),
    chars: (n: number) => (n === 1 ? "1 char" : `${n} chars`),
    lines: (n: number) => (n === 1 ? "1 line" : `${n} lines`),
    zoomOut: `Zoom out (${ZOOM_OUT})`,
    fontSize: "Editor font size",
    zoomIn: `Zoom in (${ZOOM_IN})`,
  },
  palette: {
    aria: "Command palette",
    placeholder: "Type a command…",
    empty: "No matching commands",
  },
  find: {
    placeholder: "Find…",
    replacePlaceholder: "Replace with…",
    zero: "0 results",
    mark: (n: number) => `Match ${n}`,
    prev: `Previous (${KSHIFT}Enter)`,
    next: "Next (Enter)",
    replace: "Replace",
    replaceTitle: "Replace current (Enter in the replace field)",
    all: "All",
    allTitle: "Replace all",
    close: "Close (Esc)",
    replacedOne: (i: number, total: number) => `Replaced ${i}/${total}`,
    replacedAll: (n: number) => `Replaced ${n} occurrence${n === 1 ? "" : "s"}`,
  },
  outline: {
    title: "Outline",
    empty: "No headings",
  },
  update: {
    btn: (v: string) => `Update to v${v}`,
    btnTitle: (v: string) => `New version v${v} available — click to download and install from GitHub`,
    downloading: (p: number) => `Downloading ${p}%`,
    checking: "Checking for updates…",
    upToDate: "You're up to date",
    checkFailed: "Failed to check for updates",
    opened: "Downloaded — opening the installer…",
    revealed: "Saved to your Downloads folder — finish installing from there",
    fallback: "Download failed — the release page has been opened for manual download",
  },
  store: {
    opened: (name: string) => `Opened ${name}`,
    openFailed: "Failed to open the file",
    desktopOnly: "File features require the desktop app (yarn tauri dev)",
    multiWindow: "Multiple windows require the desktop app",
    saved: "Saved",
    saveFailed: "Failed to save",
    savedTo: (name: string) => `Saved to ${name}`,
    unnamedMd: "Untitled.md",
    autoSaveOn: "Auto-save enabled",
    autoSaveOff: "Auto-save disabled",
    autoSaveFailed: "Auto-save failed",
    discardBrowser: (name: string) => `Discard unsaved changes to “${name}”?`,
    discardAsk: (name: string) => `“${name}” has unsaved changes. Discard them?`,
  },
  page: {
    tocInserted: "TOC marker inserted",
    exportedWord: "Word exported",
    exportedImage: "Image exported",
    exportedPdf: "PDF exported",
    printOpened: "PDF generated and opened in the system viewer — print from there",
    generating: "Generating image…",
    generatingPdf: "Generating PDF…",
    exportFailed: "Export failed",
    saveFirst: "Save the file before inserting images",
    imageAlt: "image",
    imageInserted: "Image inserted",
    imageSaveFailed: "Failed to save the image",
    imageInsertFailed: "Failed to insert the image",
    externalReloaded: (name: string) => `“${name}” was modified externally and has been reloaded`,
    externalAsk: (name: string) =>
      `“${name}” was modified by another program. Reload? Unsaved local changes will be lost.`,
    closeConfirm: (n: number) =>
      `${n} tab${n === 1 ? "" : "s"} ha${n === 1 ? "s" : "ve"} unsaved changes. Save before closing?`,
  },
  exporter: {
    desktopOnly: "Exporting requires the desktop app",
    screenshotFailed: "Screenshot failed",
  },
  file: {
    filterMd: "Markdown / Text",
    filterAll: "All Files",
  },
  guide: {
    back: "‹ Back to Editor",
    title: "Markdown Syntax Guide",
  },
  about: {
    back: "‹ Back to Editor",
    title: "About",
    logoAlt: (name: string) => `${name} logo`,
    version: (v: string) => `Version ${v}`,
    tagline: "Fast startup · Fast loading · Tiny footprint",
    desc1: "Native core (Tauri 2 + Rust) — cold start in ~0.3 s, files open instantly.",
    desc2: "Preview mode renders as you type; source mode stays fast and clean.",
    speed1: "⚡ Cold start ~0.3s",
    speed2: "📄 Large files open instantly",
    speed3: "📦 ~11 MB installer",
    privacy: "🔒 Privacy first: no personal data collected — network access is only to GitHub Releases for downloading updates",
    checkUpdate: "Check for Updates",
    install: (v: string) => `Download & install v${v}`,
    license: "MIT License · Built with Tauri / Svelte / Vditor / CodeMirror",
  },
};

const DICTS: Record<Lang, Dict> = { zh, en };

class I18nStore {
  /** 当前语言（模块加载时按系统语言确定，会话内不变） */
  lang = $state<Lang>(detectLang());

  constructor() {
    if (typeof document !== "undefined") {
      document.documentElement.lang = this.lang === "zh" ? "zh-CN" : "en";
    }
  }

  /** 当前语言字典 */
  get t(): Dict {
    return DICTS[this.lang];
  }
}

export const i18n = new I18nStore();
