<script lang="ts">
  /** 查找替换栏（VSCode 风格）：
   *  - 打开即聚焦查找框，预填选中文本；Enter 下一处 / ⇧Enter 上一处 / Esc 关闭
   *  - 匹配显示「当前/总数」；替换作用于 Markdown 源文本（两模式一致）
   *  - 高亮：源码模式用 CodeMirror 装饰；预览模式用 CSS Highlight API
   *  - 编辑区右侧滚动条标记条：所有匹配黄块、当前项橙块，点击跳转
   */
  import { untrack } from "svelte";
  import { EditorView } from "@codemirror/view";
  import { setFindState } from "$lib/findExtension";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";

  let query = $state("");
  let replacement = $state("");
  let current = $state(0);
  let findInput = $state<HTMLInputElement | undefined>(undefined);

  /** 滚动条标记：{ 顶部比例, 是否当前项, 序号 } */
  let railMarks = $state<{ r: number; cur: boolean; i: number }[]>([]);

  const content = $derived(editor.active?.content ?? "");

  /** 源文本中所有匹配的起点索引 */
  const matches = $derived.by(() => {
    if (!query) return [] as number[];
    const list: number[] = [];
    let i = content.indexOf(query);
    while (i >= 0) {
      list.push(i);
      i = content.indexOf(query, i + query.length);
    }
    return list;
  });

  // 索引越界时收敛（输入、替换后匹配数变化）
  $effect(() => {
    if (current >= matches.length) current = Math.max(0, matches.length - 1);
  });

  /* ---------- 打开：预填选中文本 + 自动聚焦 ---------- */

  $effect(() => {
    if (!editor.findOpen) return;
    const sel = window.getSelection()?.toString() ?? "";
    if (!untrack(() => query) && sel && sel.length <= 200 && !sel.includes("\n")) {
      query = sel;
      current = 0;
    }
    queueMicrotask(() => {
      findInput?.focus();
      findInput?.select();
    });
  });

  /* ---------- 源码模式（CodeMirror 装饰 + 居中定位） ---------- */

  function applySourceHighlight(idx: number, center = false) {
    const view = editor.cmView as EditorView | null;
    if (!view) return;
    view.dispatch({
      effects: setFindState.of({ query, matches, current: idx }),
    });
    const from = matches[idx];
    if (from === undefined) return;
    // CodeMirror 6 滚动定位需通过 scrollIntoView effect（实例上无 scrollIntoView 方法）
    view.dispatch({
      selection: { anchor: from, head: from + query.length },
      effects: EditorView.scrollIntoView(from, {
        y: center ? "center" : "nearest",
        yMargin: center ? 0 : 60,
      }),
    });
  }

  function clearSourceHighlight() {
    const view = editor.cmView as EditorView | null;
    view?.dispatch({
      effects: setFindState.of({ query: "", matches: [], current: 0 }),
    });
  }

  /* ---------- 预览模式（DOM 覆盖层色块，不依赖 Highlight API、不碰编辑器内容） ---------- */

  /** 向上找真正的滚动容器 */
  function findScroller(el: Node | null): HTMLElement | null {
    let n: Element | null =
      el?.nodeType === Node.ELEMENT_NODE ? (el as Element) : (el?.parentElement ?? null);
    while (n && n !== document.body) {
      if (n.scrollHeight > n.clientHeight + 4) return n as HTMLElement;
      n = n.parentElement;
    }
    return null;
  }

  /** 渲染区根节点：vditor 会留多个 pre.vditor-reset（含隐藏空壳），必须取可见的那个 */
  function previewRoot(): HTMLElement | null {
    const pres = document.querySelectorAll(".preview-pane pre.vditor-reset");
    for (const el of pres) {
      if ((el as HTMLElement).offsetParent !== null) return el as HTMLElement;
    }
    return (pres[pres.length - 1] as HTMLElement) ?? null;
  }

  /** 收集渲染区文本匹配（跳过 IR 语法标记节点） */
  function collectPreviewRanges(): Range[] {
    const root = previewRoot();
    if (!root || !query) return [];
    const ranges: Range[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('[class*="marker"]')) continue;
      const text = node.nodeValue ?? "";
      let idx = text.indexOf(query);
      while (idx >= 0) {
        const r = document.createRange();
        r.setStart(node, idx);
        r.setEnd(node, idx + query.length);
        ranges.push(r);
        idx = text.indexOf(query, idx + query.length);
      }
    }
    return ranges;
  }

  /** 获取/创建预览区高亮覆盖层（挂在滚动容器内，随内容滚动） */
  function getOverlay(root: HTMLElement): HTMLElement {
    let overlay = root.querySelector(":scope > .md66-find-overlay") as HTMLElement | null;
    if (!overlay) {
      const scroller = findScroller(root) ?? root;
      if (getComputedStyle(scroller).position === "static") {
        scroller.style.position = "relative";
      }
      overlay = document.createElement("div");
      overlay.className = "md66-find-overlay";
      scroller.appendChild(overlay);
    }
    return overlay;
  }

  function applyPreviewHighlight(idx: number, center = false) {
    const root = previewRoot();
    if (!root) return;
    const ranges = collectPreviewRanges();
    const overlay = getOverlay(root);
    overlay.innerHTML = "";
    if (!ranges.length) return;

    const scroller = findScroller(root) ?? root;
    const base = scroller.getBoundingClientRect();
    ranges.forEach((r, i) => {
      const isCur = i === idx % ranges.length;
      // getClientRects 每个换行片段一个矩形，逐段画块
      for (const rect of Array.from(r.getClientRects())) {
        if (rect.width === 0 || rect.height === 0) continue;
        const d = document.createElement("div");
        d.className = isCur ? "md66-find-cur" : "md66-find-all";
        d.style.left = `${rect.left - base.left}px`;
        d.style.top = `${rect.top - base.top + scroller.scrollTop}px`;
        d.style.width = `${rect.width}px`;
        d.style.height = `${rect.height}px`;
        overlay.appendChild(d);
      }
    });

    // 滚动到当前项
    const curRange = ranges[idx % ranges.length];
    const target = curRange.startContainer.parentElement;
    if (center) {
      target?.scrollIntoView({ block: "center" });
      return;
    }
    const rect = curRange.getBoundingClientRect();
    const pane = document.querySelector(".pane.show")?.getBoundingClientRect();
    if (rect && pane && (rect.top < pane.top + 40 || rect.bottom > pane.bottom - 40)) {
      target?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function clearPreviewHighlight() {
    document
      .querySelectorAll(".md66-find-overlay")
      .forEach((el) => el.remove());
  }

  /* ---------- 滚动条标记条 ---------- */

  function computeRail() {
    const marks: { r: number; cur: boolean; i: number }[] = [];
    if (editor.mode === "source") {
      const view = editor.cmView as EditorView | null;
      const scroller = view?.dom?.querySelector(".cm-scroller") as HTMLElement | null;
      if (view && scroller) {
        const base = scroller.getBoundingClientRect().top;
        matches.forEach((from, i) => {
          const pos = view.coordsAtPos(from);
          if (!pos) return;
          marks.push({
            r: (pos.top - base + scroller.scrollTop) / scroller.scrollHeight,
            cur: i === current,
            i,
          });
        });
      }
    } else {
      const ranges = collectPreviewRanges();
      const scroller = findScroller(ranges[0]?.startContainer ?? null);
      if (scroller && ranges.length) {
        const base = scroller.getBoundingClientRect().top;
        ranges.forEach((r, i) => {
          const rect = r.getBoundingClientRect();
          marks.push({
            r: (rect.top - base + scroller.scrollTop) / scroller.scrollHeight,
            cur: i === current,
            i,
          });
        });
      }
    }
    railMarks = marks;
  }

  /* ---------- 状态变化时统一应用 ---------- */

  $effect(() => {
    // 依赖：开关、模式、query、matches、current、内容
    const open = editor.findOpen;
    const mode = editor.mode;
    const n = matches.length;
    if (!open || !query || n === 0) {
      clearSourceHighlight();
      clearPreviewHighlight();
      railMarks = [];
      return;
    }
    const idx = Math.min(current, n - 1);
    // 先清掉另一种模式的残留高亮，再应用当前模式的高亮
    clearSourceHighlight();
    clearPreviewHighlight();
    if (mode === "source") applySourceHighlight(idx);
    else applyPreviewHighlight(idx);
    computeRail();
  });

  /** 关闭时彻底清理 */
  $effect(() => {
    if (!editor.findOpen) {
      clearSourceHighlight();
      clearPreviewHighlight();
      railMarks = [];
    }
  });

  /* ---------- 跳转 / 替换 ---------- */

  function gotoAt(idx: number, center = true) {
    if (!query || matches.length === 0) return;
    current = (idx + matches.length) % matches.length;
    if (editor.mode === "source") applySourceHighlight(current, center);
    else applyPreviewHighlight(current, center);
  }

  function goto(dir: 1 | -1) {
    if (!query || matches.length === 0) return;
    gotoAt(current + dir);
  }

  /** 替换当前处（作用于源文本，两种模式一致） */
  function replaceCurrent() {
    const tab = editor.active;
    if (!tab || !query || matches.length === 0) return;
    // 赋值 tab.content 会触发 matches 重算，提示文字需先快照替换前的计数
    const idx = Math.min(current, matches.length - 1);
    const total = matches.length;
    const from = matches[idx];
    tab.content =
      tab.content.slice(0, from) + replacement + tab.content.slice(from + query.length);
    editor.flash(i18n.t.find.replacedOne(idx + 1, total));
  }

  function replaceAll() {
    const tab = editor.active;
    if (!tab || !query || matches.length === 0) return;
    const total = matches.length;
    tab.content = tab.content.split(query).join(replacement);
    editor.flash(i18n.t.find.replacedAll(total));
  }

  /* ---------- 键盘 ---------- */

  /** 已打开时再按 ⌘F：重新聚焦查找框 */
  function onWindowKeydown(e: KeyboardEvent) {
    if (!editor.findOpen) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      queueMicrotask(() => {
        findInput?.focus();
        findInput?.select();
      });
    }
  }

  function onFindKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      goto(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      editor.findOpen = false;
    }
  }

  function onReplaceKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      replaceCurrent();
      goto(1);
    } else if (e.key === "Escape") {
      editor.findOpen = false;
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      findInput?.focus();
    }
  }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if editor.findOpen}
  <!-- 滚动条标记条（VSCode 式：黄块=匹配，橙块=当前项，点击跳转） -->
  {#if railMarks.length}
    <div class="find-rail">
      {#each railMarks as m (m.i)}
        <button
          type="button"
          class="mark"
          class:cur={m.cur}
          style="top: {Math.min(98, Math.max(0, m.r * 100))}%"
          title={i18n.t.find.mark(m.i + 1)}
          onclick={() => gotoAt(m.i)}
        ></button>
      {/each}
    </div>
  {/if}

  <div class="findbar">
    <div class="field">
      <input
        bind:this={findInput}
        type="text"
        placeholder={i18n.t.find.placeholder}
        bind:value={query}
        onkeydown={onFindKeydown}
      />
      <span class="count">
        {matches.length > 0 ? `${Math.min(current + 1, matches.length)}/${matches.length}` : query ? i18n.t.find.zero : ""}
      </span>
    </div>
    <input
      type="text"
      class="replace-input"
      placeholder={i18n.t.find.replacePlaceholder}
      bind:value={replacement}
      onkeydown={onReplaceKeydown}
    />
    <div class="btns">
      <button type="button" title={i18n.t.find.prev} onclick={() => goto(-1)} disabled={!matches.length}>↑</button>
      <button type="button" title={i18n.t.find.next} onclick={() => goto(1)} disabled={!matches.length}>↓</button>
      <button type="button" title={i18n.t.find.replaceTitle} onclick={replaceCurrent} disabled={!matches.length}>{i18n.t.find.replace}</button>
      <button type="button" title={i18n.t.find.allTitle} onclick={replaceAll} disabled={!matches.length}>{i18n.t.find.all}</button>
      <button type="button" class="close" title={i18n.t.find.close} onclick={() => (editor.findOpen = false)}>×</button>
    </div>
  </div>
{/if}

<style>
  .findbar {
    position: absolute;
    top: 8px;
    right: 20px;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-raised);
    box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  }

  .field {
    position: relative;
    display: flex;
    align-items: center;
  }

  input {
    width: 170px;
    height: 26px;
    padding: 0 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 12.5px;
    font-family: inherit;
    color: var(--text);
    background: var(--bg);
    outline: none;
  }

  input:focus {
    border-color: var(--accent);
  }

  .replace-input {
    width: 130px;
  }

  .count {
    position: absolute;
    right: 8px;
    font-size: 11px;
    color: var(--text-dim);
    pointer-events: none;
  }

  .btns {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .btns button {
    appearance: none;
    border: none;
    border-radius: 6px;
    height: 26px;
    min-width: 28px;
    padding: 0 8px;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  .btns button:hover:not(:disabled) {
    color: var(--text);
    background: var(--hover);
  }

  .btns button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .btns .close {
    font-size: 15px;
  }

  /* ---------- 滚动条标记条 ---------- */

  .find-rail {
    position: absolute;
    top: 0;
    bottom: 0;
    right: 3px;
    width: 7px;
    z-index: 50;
    pointer-events: none;
  }

  .find-rail .mark {
    position: absolute;
    left: 0;
    width: 6px;
    height: 5px;
    padding: 0;
    border: none;
    border-radius: 3px;
    background: rgb(255 190 0 / 80%);
    transform: translateY(-2px);
    pointer-events: auto;
    cursor: pointer;
  }

  .find-rail .mark:hover {
    background: rgb(255 190 0);
  }

  .find-rail .mark.cur {
    height: 9px;
    background: rgb(255 96 0);
    box-shadow: 0 0 0 1px rgb(140 40 0 / 60%);
  }

  /* ---------- VSCode 风格匹配高亮 ---------- */

  /* 源码模式（CodeMirror 装饰，真实元素可加描边） */
  :global(.cm-md66-find) {
    background: rgb(255 199 0 / 72%);
    border-radius: 2px;
  }

  :global(.cm-md66-find-cur) {
    background: rgb(255 96 0 / 88%);
    border-radius: 2px;
    outline: 2px solid rgb(160 50 0 / 90%);
    outline-offset: -1px;
  }

  /* 预览模式（覆盖层色块：支持描边，随内容滚动） */
  :global(.md66-find-overlay) {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    overflow: visible;
    pointer-events: none;
    z-index: 30;
  }

  :global(.md66-find-overlay .md66-find-all) {
    position: absolute;
    background: rgb(255 199 0 / 55%);
    border-radius: 2px;
  }

  :global(.md66-find-overlay .md66-find-cur) {
    position: absolute;
    background: rgb(255 96 0 / 45%);
    border: 2px solid rgb(214 78 0);
    border-radius: 2px;
    box-sizing: border-box;
  }

  @media print {
    .findbar,
    .find-rail {
      display: none;
    }
  }
</style>
