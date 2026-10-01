<script lang="ts">
  /** 大纲面板：标题导航，点击跳转（预览模式滚动到标题；源码模式定位到行） */
  import type { EditorView } from "@codemirror/view";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";

  interface Heading {
    level: number;
    text: string;
    line: number;
  }

  let headings = $derived.by(() => parseOutline(editor.active?.content ?? ""));

  /** 解析标题（跳过代码围栏内的 #） */
  function parseOutline(md: string): Heading[] {
    const result: Heading[] = [];
    let inFence = false;
    md.split("\n").forEach((raw, i) => {
      if (/^\s*(```|~~~)/.test(raw)) inFence = !inFence;
      if (inFence) return;
      const m = /^(#{1,6})\s+(.+?)\s*#*$/.exec(raw);
      if (m) result.push({ level: m[1].length, text: m[2], line: i });
    });
    return result;
  }

  function jump(h: Heading) {
    if (editor.mode === "source") {
      const view = editor.cmView as EditorView | null;
      if (!view) return;
      const pos = view.state.doc.line(h.line + 1).from;
      view.dispatch({
        selection: { anchor: pos },
        scrollIntoView: true,
      });
      view.focus();
    } else {
      // 预览 DOM 的标题文本含 "#" 标记，剥离后按"同文本第 N 次出现"匹配
      const same = headings.filter((x) => x.text === h.text && x.level === h.level);
      const occurrence = same.indexOf(h);
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>(".vditor-ir h1,h2,h3,h4,h5,h6"),
      ).filter(
        (n) =>
          n.tagName.toLowerCase() === `h${h.level}` &&
          n.textContent?.replace(/^#+\s*/, "").trim() === h.text,
      );
      nodes[Math.min(occurrence, nodes.length - 1)]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }
</script>

<aside class="outline">
  <div class="title">{i18n.t.outline.title}</div>
  {#if headings.length === 0}
    <div class="empty">{i18n.t.outline.empty}</div>
  {:else}
    {#each headings as h (h.line + h.text)}
      <button
        type="button"
        style="padding-left: {8 + (h.level - 1) * 14}px"
        onclick={() => jump(h)}
        title={h.text}
      >
        {h.text}
      </button>
    {/each}
  {/if}
</aside>

<style>
  .outline {
    flex: none;
    width: 220px;
    overflow-y: auto;
    padding: 10px 8px;
    border-right: 1px solid var(--border);
    background: var(--bg);
  }

  .title {
    padding: 2px 8px 8px;
    font-size: 11.5px;
    color: var(--text-dim);
    user-select: none;
  }

  .empty {
    padding: 4px 8px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .outline button {
    display: block;
    width: 100%;
    appearance: none;
    border: none;
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 12.5px;
    font-family: inherit;
    text-align: left;
    color: var(--text);
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .outline button:hover {
    background: var(--hover);
  }

  @media print {
    .outline {
      display: none;
    }
  }
</style>
