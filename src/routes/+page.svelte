<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import type { Command } from "$lib/components/CommandPalette.svelte";
  import FindBar from "$lib/components/FindBar.svelte";
  import MenuBar from "$lib/components/MenuBar.svelte";
  import type { MenuDef, MenuItem } from "$lib/components/MenuBar.svelte";
  import Outline from "$lib/components/Outline.svelte";
  import PreviewPane from "$lib/components/PreviewPane.svelte";
  import SourcePane from "$lib/components/SourcePane.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import TabBar from "$lib/components/TabBar.svelte";
  import { APP_NAME, APP_VERSION } from "$lib/appInfo";
  import { editor } from "$lib/editorStore.svelte";
  import {
    basename,
    dirname,
    isTauri,
    readBinary,
    saveImageAsset,
    setWindowTitle,
  } from "$lib/fileService";
  import { exportImage, exportWord, printDocument } from "$lib/exporter";

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";

  const active = $derived(editor.active);
  const fileName = $derived(active ? (active.path ? basename(active.path) : "") : "");
  const dirty = $derived(!!active && active.content !== active.saved);
  const assetDir = $derived(active?.path ? dirname(active.path) : null);

  /* ---------- 系统深浅色 ---------- */
  $effect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    editor.dark = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (editor.dark = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  /* ---------- 自动保存 & 标题 ---------- */
  $effect(() => {
    // 追踪所有标签内容的变化（编辑、打开、切换都会触发）
    const contents = editor.tabs.map((t) => t.content);
    const savedList = editor.tabs.map((t) => t.saved);
    if (contents.length === 0) return;
    if (contents.some((c, i) => c !== savedList[i])) editor.scheduleAutoSave();
  });

  $effect(() => {
    const title = fileName
      ? `${dirty ? "● " : ""}${fileName} — ${APP_NAME}`
      : APP_NAME;
    document.title = title;
    if (isTauri) void setWindowTitle(title);
  });

  /* ---------- 命令 ---------- */

  async function newWindow() {
    if (!isTauri) return editor.flash("多窗口需在桌面应用中使用");
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    await new WebviewWindow(`md66-${Date.now()}`, { url: "/", title: APP_NAME });
  }

  async function closeActiveTab() {
    if (active) await editor.closeTab(active.id);
  }

  function toggleOutline() {
    editor.outlineOpen = !editor.outlineOpen;
  }

  function insertToc() {
    editor.insertToActive("[TOC]\n\n");
    editor.flash("已插入目录标记");
  }

  async function doExportWord() {
    if (!active) return;
    try {
      await exportWord(active.content, active.path);
      editor.flash("已导出 Word");
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : "导出失败");
    }
  }

  async function doExportImage() {
    if (!active) return;
    editor.flash("正在生成图片…");
    try {
      await exportImage(active.content, active.path, editor.dark);
      editor.flash("已导出图片");
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : "导出失败");
    }
  }

  /* ---------- 菜单 ---------- */

  const menus = $derived<MenuDef[]>([
    {
      label: "文件",
      items: [
        { label: "新建窗口", shortcut: `${mod}N`, action: () => void newWindow() },
        { label: "新建标签", shortcut: `${mod}T`, action: () => editor.openBlankTab("") },
        { label: "打开…", shortcut: `${mod}O`, action: () => void editor.openFilePicker() },
        ...(editor.recents.length > 0
          ? [
              { separator: true } as MenuItem,
              ...editor.recents.map(
                (p) =>
                  ({
                    label: basename(p),
                    action: () => void editor.openPath(p),
                  }) as MenuItem,
              ),
            ]
          : []),
        { separator: true },
        { label: "保存", shortcut: `${mod}S`, action: () => void editor.saveActive() },
        { label: "另存为…", shortcut: `${mod}⇧S`, action: () => void editor.saveActiveAs() },
        { label: `自动保存${editor.autoSave ? " ✓" : ""}`, action: () => editor.toggleAutoSave() },
        { separator: true },
        { label: "导出 PDF…（打印对话框中选“存储为 PDF”）", action: printDocument },
        { label: "导出 Word…", action: () => void doExportWord() },
        { label: "导出图片…", action: () => void doExportImage() },
        { separator: true },
        { label: "打印…", shortcut: `${mod}P`, action: printDocument },
        { separator: true },
        { label: "关闭标签", shortcut: `${mod}W`, action: () => void closeActiveTab() },
      ],
    },
    {
      label: "编辑",
      items: [
        { label: "查找替换…", shortcut: `${mod}F`, action: () => (editor.findOpen = !editor.findOpen) },
        { separator: true },
        { label: "插入目录（TOC）", action: insertToc },
        { label: "插入当前日期", action: () => editor.insertToActive(new Date().toLocaleDateString("zh-CN")) },
      ],
    },
    {
      label: "视图",
      items: [
        { label: "预览模式", shortcut: `${mod}/`, action: () => (editor.mode = "preview") },
        { label: "源码模式", shortcut: `${mod}/`, action: () => (editor.mode = "source") },
        { separator: true },
        { label: `大纲面板${editor.outlineOpen ? " ✓" : ""}`, shortcut: `${mod}⇧O`, action: toggleOutline },
        { separator: true },
        { label: "放大字体", shortcut: `${mod}+`, action: () => editor.zoomFont(1) },
        { label: "缩小字体", shortcut: `${mod}-`, action: () => editor.zoomFont(-1) },
        { label: "重置字体", shortcut: `${mod}0`, action: () => editor.zoomFont(0, true) },
        { separator: true },
        { label: `深色模式${editor.dark ? " ✓" : ""}`, action: () => (editor.dark = !editor.dark) },
      ],
    },
    {
      label: "帮助",
      items: [
        { label: "Markdown 语法说明", action: () => goto("/guide") },
        { label: "命令面板", shortcut: `${mod}⇧P`, action: () => (editor.paletteOpen = true) },
        { separator: true },
        { label: `关于 ${APP_NAME}（v${APP_VERSION}）`, action: () => goto("/about") },
      ],
    },
  ]);

  const commands = $derived.by(() => {
    const list: Command[] = [];
    for (const menu of menus) {
      for (const item of menu.items) {
        if (item.separator || !item.label || item.disabled) continue;
        if (!item.action) continue;
        list.push({
          id: `${menu.label}:${item.label}`,
          label: `${menu.label} ▸ ${item.label.replace(" ✓", "")}`,
          shortcut: item.shortcut,
          run: item.action,
        });
      }
    }
    return list;
  });

  /* ---------- 快捷键 ---------- */

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      editor.findOpen = false;
      editor.paletteOpen = false;
      return;
    }
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === "/") {
      e.preventDefault();
      editor.mode = editor.mode === "preview" ? "source" : "preview";
    } else if (key === "f") {
      e.preventDefault();
      // 始终打开（不 toggle）：已打开时重新聚焦由 FindBar 自身处理
      editor.findOpen = true;
    } else if (key === "p" && e.shiftKey) {
      e.preventDefault();
      editor.paletteOpen = true;
    } else if (key === "p") {
      e.preventDefault();
      printDocument();
    } else if (key === "o" && e.shiftKey) {
      e.preventDefault();
      toggleOutline();
    } else if (key === "o") {
      e.preventDefault();
      void editor.openFilePicker();
    } else if (key === "s" && e.shiftKey) {
      e.preventDefault();
      void editor.saveActiveAs();
    } else if (key === "s") {
      e.preventDefault();
      void editor.saveActive();
    } else if (key === "t") {
      e.preventDefault();
      editor.openBlankTab("");
    } else if (key === "n") {
      e.preventDefault();
      void newWindow();
    } else if (key === "w") {
      e.preventDefault();
      void closeActiveTab();
    } else if (key === "=" || key === "+") {
      e.preventDefault();
      editor.zoomFont(1);
    } else if (key === "-") {
      e.preventDefault();
      editor.zoomFont(-1);
    } else if (key === "0") {
      e.preventDefault();
      editor.zoomFont(0, true);
    }
  }

  /* ---------- 粘贴 / 拖拽图片 ---------- */

  async function insertImageFromData(name: string, ext: string, data: Uint8Array) {
    const tab = editor.active;
    if (!tab) return;
    if (!tab.path) {
      editor.flash("请先保存文件后再插入图片");
      return;
    }
    try {
      const rel = await saveImageAsset(dirname(tab.path), ext, data);
      if (rel) {
        editor.insertToActive(`\n![${name || "图片"}](${rel})\n`);
        editor.flash("图片已插入");
      }
    } catch {
      editor.flash("图片保存失败");
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const tab = editor.active;
    if (!tab || !isTauri) return;
    const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return; // 非图片走默认粘贴
    e.preventDefault();
    void (async () => {
      const ext = (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      const data = new Uint8Array(await file.arrayBuffer());
      await insertImageFromData(file.name, ext, data);
    })();
  }

  /** Tauri 拖拽事件（提供绝对路径）：文本文件打开，图片复制到 assets */
  async function handleDroppedPaths(paths: string[]) {
    const { TEXT_EXTENSIONS } = await import("$lib/fileService");
    const textExtRe = new RegExp(
      `\\.(${TEXT_EXTENSIONS.join("|")})$`, "i",
    );
    for (const path of paths) {
      if (textExtRe.test(path)) {
        await editor.openPath(path);
      } else if (/\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(path)) {
        try {
          const data = await readBinary(path);
          await insertImageFromData(basename(path), (path.split(".").pop() ?? "png").toLowerCase(), data);
        } catch {
          editor.flash("图片插入失败");
        }
      }
    }
  }

  /* ---------- 外部修改检测 ---------- */

  async function checkExternalChanges() {
    if (!isTauri) return;
    for (const tab of editor.tabs) {
      if (!tab.path) continue;
      try {
        const { readMarkdown } = await import("$lib/fileService");
        const diskNow = await readMarkdown(tab.path);
        const changed = tab.disk !== null && diskNow !== tab.disk;
        tab.disk = diskNow;
        if (!changed) continue;
        if (tab.content === tab.saved) {
          // 本地无修改，静默重载
          tab.content = diskNow;
          tab.saved = diskNow;
          editor.flash(`「${basename(tab.path)}」已被外部修改，已重新加载`);
        } else if (tab.id === editor.activeId) {
          const { ask } = await import("@tauri-apps/plugin-dialog");
          const reload = await ask(
            `「${basename(tab.path)}」已被其他程序修改，重新加载吗？本地未保存的修改将丢失。`,
            { title: APP_NAME, kind: "warning" },
          );
          if (reload) {
            tab.content = diskNow;
            tab.saved = diskNow;
          }
        }
      } catch {
        // 文件被删除或不可读：忽略
      }
    }
  }

  /* ---------- 桌面事件注册（关闭确认 / 拖拽） ---------- */

  onMount(() => {
    let cleanups: (() => void)[] = [];
    let disposed = false;

    // 系统双击文件打开（macOS RunEvent::Opened / Windows-Linux CLI args）。
    // 必须最先注册且独立容错：任何其它初始化失败都不能阻断文件打开。
    (async () => {
      if (!isTauri) return;
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const un = await listen<string[]>("file-open", (e) => {
          const files = Array.isArray(e.payload) ? e.payload : [];
          for (const p of files) void editor.openPath(p);
        });
        if (disposed) return un();
        cleanups.push(un);
      } catch (err) {
        console.error("file-open 监听注册失败", err);
      }
      // 冷启动兜底：macOS 的 Opened 事件可能晚于本逻辑执行（实测如此），
      // 短窗口内轮询暂存队列，确保拿到双击打开的文件
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        for (let i = 0; i < 15; i++) {
          const pending = await invoke<string[]>("take_pending_files");
          if (Array.isArray(pending) && pending.length > 0) {
            for (const p of pending) await editor.openPath(p);
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (err) {
        console.error("取暂存文件失败", err);
      }
    })();

    (async () => {
      if (!isTauri) return;
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();

        // 关闭前未保存提示
        const un1 = await win.onCloseRequested(async (event) => {
          const n = editor.dirtyCount;
          if (n === 0) return; // 无修改，正常关闭
          event.preventDefault();
          const { ask } = await import("@tauri-apps/plugin-dialog");
          const save = await ask(`${n} 个标签有未保存的修改，关闭前保存吗？`, {
            title: APP_NAME,
            kind: "warning",
          });
          if (save) await editor.saveAllDirty();
          await win.destroy();
        });

        // 拖拽文件进入窗口（md 打开 / 图片插入）
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const un2 = await getCurrentWebview().onDragDropEvent((e) => {
          if (e.payload.type === "drop") void handleDroppedPaths(e.payload.paths);
        });

        if (disposed) {
          un1();
          un2();
          return;
        }
        cleanups.push(un1, un2);
      } catch (err) {
        console.error("窗口事件初始化失败", err);
      }
    })();

    return () => {
      disposed = true;
      cleanups.forEach((fn) => fn());
    };
  });
</script>

<svelte:window onkeydown={handleKeydown} onpaste={handlePaste} onfocus={checkExternalChanges} />

<div class="app" class:dark={editor.dark}>
  <header>
    <MenuBar {menus} />

    <span
      class="file-name"
      class:dirty
      title={active?.path ?? "未关联文件，修改会自动存为草稿"}
    >
      {fileName}
    </span>

    <div class="seg" role="tablist" aria-label="编辑模式">
      <button
        type="button"
        class:on={editor.mode === "preview"}
        onclick={() => (editor.mode = "preview")}
        title="在渲染后的富文本界面上直接编辑"
      >
        预览
      </button>
      <button
        type="button"
        class:on={editor.mode === "source"}
        onclick={() => (editor.mode = "source")}
        title="编辑原始 Markdown 文本"
      >
        源码
      </button>
    </div>

    <span class="hint">{dirty ? "未保存…" : `${mod}/ 切换模式`}</span>
  </header>

  <TabBar />

  <div class="body">
    {#if editor.outlineOpen}
      <Outline />
    {/if}

    <main>
      {#if active}
        {#key active.id}
          <div class="pane" class:show={editor.mode === "preview"}>
            <PreviewPane
              bind:value={active.content}
              active={editor.mode === "preview"}
              dark={editor.dark}
              fontPx={editor.fontPx}
              assetDir={assetDir}
            />
          </div>
          <div class="pane" class:show={editor.mode === "source"}>
            <SourcePane
              bind:value={active.content}
              active={editor.mode === "source"}
              dark={editor.dark}
              fontPx={editor.fontPx}
            />
          </div>
        {/key}
      {/if}
      <FindBar />
    </main>
  </div>

  <StatusBar />

  <CommandPalette {commands} />
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
    overflow: hidden;
  }

  .app {
    --bg: #ffffff;
    --bg-header: #f7f7f8;
    --bg-raised: #ffffff;
    --hover: rgb(0 0 0 / 6%);
    --border: #e3e3e6;
    --text: #1f2328;
    --text-dim: #6e7480;
    --accent: #316ef4;
    --accent-text: #ffffff;

    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }

  .app.dark {
    --bg: #1e2023;
    --bg-header: #24262a;
    --bg-raised: #2a2d31;
    --hover: rgb(255 255 255 / 8%);
    --border: #34363b;
    --text: #d7dae0;
    --text-dim: #8b909b;
    --accent: #5b8cff;
    --accent-text: #0d1117;
  }

  header {
    flex: none;
    height: 40px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 10px;
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    user-select: none;
  }

  .file-name {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-size: 12.5px;
    color: var(--text-dim);
  }

  .file-name.dirty {
    color: var(--text);
  }

  .file-name.dirty::before {
    content: "● ";
    color: #e5484d;
  }

  .file-name:empty {
    display: none;
  }

  .seg {
    display: flex;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
  }

  .seg button {
    appearance: none;
    border: none;
    border-radius: 6px;
    padding: 3px 12px;
    font-size: 12.5px;
    line-height: 1.4;
    font-family: inherit;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
    transition:
      color 0.15s,
      background-color 0.15s;
  }

  .seg button:hover {
    color: var(--text);
  }

  .seg button.on {
    color: var(--accent-text);
    background: var(--accent);
  }

  .hint {
    margin-left: auto;
    flex: none;
    font-size: 11.5px;
    color: var(--text-dim);
    white-space: nowrap;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  main {
    flex: 1;
    min-width: 0;
    position: relative;
  }

  .pane {
    position: absolute;
    inset: 0;
    display: none;
  }

  .pane.show {
    display: block;
  }

  /* 打印：只输出当前内容，隐藏界面框架与源码模式 */
  @media print {
    :global(html),
    :global(body) {
      height: auto;
      overflow: visible;
    }

    header,
    .hint,
    .file-name,
    .seg {
      display: none !important;
    }

    .app {
      height: auto;
      display: block;
    }

    .body {
      display: block;
    }

    .pane.show {
      position: static;
    }

    :global(.vditor-ir [class*="marker"]) {
      display: none !important;
    }
  }
</style>
