<script lang="ts">
  /** 底部状态栏：提示信息 + 字数统计 + 字号 */
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";

  let content = $derived(editor.active?.content ?? "");

  let stats = $derived.by(() => {
    const text = content;
    const lines = text.length === 0 ? 1 : text.split("\n").length;
    const chars = text.replace(/\s/g, "").length;
    const cjk = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
    const words =
      (text.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, " ").match(/[A-Za-z0-9_'’-]+/g) ?? [])
        .length + cjk;
    return { lines, chars, words };
  });
</script>

<footer class="statusbar">
  <span class="msg">{editor.statusMsg}</span>
  <span class="stats">
    <span>{i18n.t.status.words(stats.words)}</span>
    <span>{i18n.t.status.chars(stats.chars)}</span>
    <span>{i18n.t.status.lines(stats.lines)}</span>
    <span class="sep"></span>
    <button type="button" title={i18n.t.status.zoomOut} onclick={() => editor.zoomFont(-1)}>−</button>
    <span class="zoom" title={i18n.t.status.fontSize}>{editor.fontPx}px</span>
    <button type="button" title={i18n.t.status.zoomIn} onclick={() => editor.zoomFont(1)}>+</button>
  </span>
</footer>

<style>
  .statusbar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    height: 26px;
    padding: 0 12px;
    background: var(--bg-header);
    border-top: 1px solid var(--border);
    font-size: 11.5px;
    color: var(--text-dim);
    user-select: none;
  }

  .msg {
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .stats {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: none;
  }

  .sep {
    width: 1px;
    height: 12px;
    background: var(--border);
  }

  .stats button {
    appearance: none;
    border: none;
    border-radius: 4px;
    width: 18px;
    height: 18px;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  .stats button:hover {
    color: var(--text);
    background: var(--hover);
  }

  .zoom {
    min-width: 30px;
    text-align: center;
  }

  @media print {
    .statusbar {
      display: none;
    }
  }
</style>
