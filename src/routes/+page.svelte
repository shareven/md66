<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import type { Command } from "$lib/components/CommandPalette.svelte";
  import FindBar from "$lib/components/FindBar.svelte";
  import { handleAnchorJump } from "$lib/anchorJump";
  import MenuBar from "$lib/components/MenuBar.svelte";
  import type { MenuDef, MenuItem } from "$lib/components/MenuBar.svelte";
  import Outline from "$lib/components/Outline.svelte";
  import PreviewPane from "$lib/components/PreviewPane.svelte";
  import SourcePane from "$lib/components/SourcePane.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import TabBar from "$lib/components/TabBar.svelte";
  import { APP_NAME, APP_VERSION } from "$lib/appInfo";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";
  import { scheduleUpdateCheck, updater } from "$lib/updater.svelte";
  import {
    basename,
    dirname,
    isTauri,
    readBinary,
    saveImageAsset,
    setWindowTitle,
  } from "$lib/fileService";
  import { exportImage, exportPdf, exportWord, printDocument } from "$lib/exporter";

  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl+";
  const shift = isMac ? "⇧" : "Shift+";

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
    if (!isTauri) return editor.flash(i18n.t.store.multiWindow);
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
    editor.flash(i18n.t.page.tocInserted);
  }

  async function doExportWord() {
    if (!active) return;
    try {
      await exportWord(active.content, active.path);
      editor.flash(i18n.t.page.exportedWord);
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : i18n.t.page.exportFailed);
    }
  }

  async function doExportPdf() {
    if (!active) return;
    editor.flash(i18n.t.page.generatingPdf);
    try {
      await exportPdf(active.content, active.path);
      editor.flash(i18n.t.page.exportedPdf);
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : i18n.t.page.exportFailed);
    }
  }

  async function doPrint() {
    if (!active) return;
    try {
      const msg = await printDocument(active.content, active.path);
      if (msg) editor.flash(msg);
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : i18n.t.page.exportFailed);
    }
  }

  async function doExportImage() {
    if (!active) return;
    editor.flash(i18n.t.page.generating);
    try {
      await exportImage(active.content, active.path, editor.dark);
      editor.flash(i18n.t.page.exportedImage);
    } catch (err) {
      editor.flash(err instanceof Error && err.message ? err.message : i18n.t.page.exportFailed);
    }
  }

  /* ---------- 菜单 ---------- */

  const menus = $derived.by<MenuDef[]>(() => {
    const t = i18n.t;
    return [
      {
        label: t.menu.file,
        items: [
          { label: t.menu.newWindow, shortcut: `${mod}N`, action: () => void newWindow() },
          { label: t.menu.newTab, shortcut: `${mod}T`, action: () => editor.openBlankTab("") },
          { label: t.menu.open, shortcut: `${mod}O`, action: () => void editor.openFilePicker() },
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
          { label: t.menu.save, shortcut: `${mod}S`, action: () => void editor.saveActive() },
          { label: t.menu.saveAs, shortcut: `${mod}${shift}S`, action: () => void editor.saveActiveAs() },
          { label: `${t.menu.autoSave}${editor.autoSave ? " ✓" : ""}`, action: () => editor.toggleAutoSave() },
          { separator: true },
          { label: t.menu.exportPdf, action: () => void doExportPdf() },
          { label: t.menu.exportWord, action: () => void doExportWord() },
          { label: t.menu.exportImage, action: () => void doExportImage() },
          { separator: true },
          { label: t.menu.print, shortcut: `${mod}P`, action: () => void doPrint() },
          { separator: true },
          { label: t.menu.closeTab, shortcut: `${mod}W`, action: () => void closeActiveTab() },
        ],
      },
      {
        label: t.menu.edit,
        items: [
          { label: t.menu.findReplace, shortcut: `${mod}F`, action: () => (editor.findOpen = !editor.findOpen) },
          { separator: true },
          { label: t.menu.insertToc, action: insertToc },
          {
            label: t.menu.insertDate,
            action: () => editor.insertToActive(new Date().toLocaleDateString(i18n.t.common.dateLocale)),
          },
        ],
      },
      {
        label: t.menu.view,
        items: [
          { label: t.menu.previewMode, shortcut: `${mod}/`, action: () => (editor.mode = "preview") },
          { label: t.menu.sourceMode, shortcut: `${mod}/`, action: () => (editor.mode = "source") },
          { separator: true },
          { label: `${t.menu.outlinePanel}${editor.outlineOpen ? " ✓" : ""}`, shortcut: `${mod}${shift}O`, action: toggleOutline },
          { separator: true },
          { label: t.menu.zoomIn, shortcut: `${mod}${isMac ? "+" : "="}`, action: () => editor.zoomFont(1) },
          { label: t.menu.zoomOut, shortcut: `${mod}-`, action: () => editor.zoomFont(-1) },
          { label: t.menu.resetZoom, shortcut: `${mod}0`, action: () => editor.zoomFont(0, true) },
          { separator: true },
          { label: `${t.menu.darkMode}${editor.dark ? " ✓" : ""}`, action: () => (editor.dark = !editor.dark) },
        ],
      },
      {
        label: t.menu.help,
        items: [
          { label: t.menu.guide, action: () => goto("/guide") },
          { label: t.menu.palette, shortcut: `${mod}${shift}P`, action: () => (editor.paletteOpen = true) },
          { label: t.menu.checkUpdate, action: () => void updater.check(true) },
          { separator: true },
          { label: t.menu.about(APP_NAME, APP_VERSION), action: () => goto("/about") },
        ],
      },
    ];
  });

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
      void doPrint();
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
      editor.flash(i18n.t.page.saveFirst);
      return;
    }
    try {
      const rel = await saveImageAsset(dirname(tab.path), ext, data);
      if (rel) {
        editor.insertToActive(`\n![${name || i18n.t.page.imageAlt}](${rel})\n`);
        editor.flash(i18n.t.page.imageInserted);
      }
    } catch {
      editor.flash(i18n.t.page.imageSaveFailed);
    }
  }

  function handlePaste(e: ClipboardEvent) {
    const tab = editor.active;
    if (!tab || !isTauri) return;
    let file: File | undefined = Array.from(e.clipboardData?.files ?? []).find(
      (f) => f.type.startsWith("image/"),
    );
    if (!file) {
      // 从网页等处复制的图片不在 files 里，只在 items 里，需兜底
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      file = item?.getAsFile() ?? undefined;
    }
    if (!file) return; // 非图片走默认粘贴
    e.preventDefault();
    // 必须阻断传播：Vditor 的 paste 处理器会无条件 stopPropagation 并接管，
    // 因此本处理器只能挂在捕获阶段（onpastecapture）才能先于它拿到事件
    e.stopPropagation();
    void (async () => {
      const ext = (file!.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
      const data = new Uint8Array(await file!.arrayBuffer());
      await insertImageFromData(file!.name, ext, data);
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
          editor.flash(i18n.t.page.imageInsertFailed);
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
          editor.flash(i18n.t.page.externalReloaded(basename(tab.path)));
        } else if (tab.id === editor.activeId) {
          const { ask } = await import("@tauri-apps/plugin-dialog");
          const reload = await ask(
            i18n.t.page.externalAsk(basename(tab.path)),
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

    // 启动后静默检查一次应用更新（GitHub Release），发现新版本时顶部显示更新按钮
    scheduleUpdateCheck();

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
          const save = await ask(i18n.t.page.closeConfirm(editor.dirtyCount), {
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

<svelte:window
  onkeydown={handleKeydown}
  onpastecapture={handlePaste}
  onfocus={checkExternalChanges}
/>

<div class="app" class:dark={editor.dark}>
  <header>
    <MenuBar {menus} />

    <span
      class="file-name"
      class:dirty
      title={active?.path ?? i18n.t.header.noFile}
    >
      {fileName}
    </span>

    <div class="seg" role="tablist" aria-label={i18n.t.header.modeAria}>
      <button
        type="button"
        class:on={editor.mode === "preview"}
        onclick={() => (editor.mode = "preview")}
        title={i18n.t.header.previewTitle}
      >
        {i18n.t.header.preview}
      </button>
      <button
        type="button"
        class:on={editor.mode === "source"}
        onclick={() => (editor.mode = "source")}
        title={i18n.t.header.sourceTitle}
      >
        {i18n.t.header.source}
      </button>
    </div>

    {#if updater.hasUpdate}
      <button
        type="button"
        class="update-btn"
        disabled={updater.phase === "downloading"}
        onclick={() => void updater.downloadAndInstall()}
        title={updater.phase === "downloading" ? "" : i18n.t.update.btnTitle(updater.latest)}
      >
        {#if updater.phase === "downloading"}
          ↓ {i18n.t.update.downloading(updater.progress)}
        {:else}
          ↓ {i18n.t.update.btn(updater.latest)}
        {/if}
      </button>
    {/if}

    <span class="hint">
      {dirty ? i18n.t.header.unsaved : i18n.t.header.toggleMode(mod)}
    </span>
  </header>

  <TabBar />

  <div class="body">
    {#if editor.outlineOpen}
      <Outline />
    {/if}

    <main onclickcapture={handleAnchorJump}>
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

  .update-btn {
    flex: none;
    height: 24px;
    padding: 0 10px;
    border: none;
    border-radius: 12px;
    font-size: 11.5px;
    line-height: 1;
    font-family: inherit;
    color: #ffffff;
    background: #1f883d;
    cursor: pointer;
    white-space: nowrap;
    transition: background-color 0.15s;
  }

  .update-btn:hover:not(:disabled) {
    background: #1a7f37;
  }

  .update-btn:disabled {
    cursor: default;
    opacity: 0.85;
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
