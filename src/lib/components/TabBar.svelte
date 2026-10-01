<script lang="ts">
  /** 多标签栏 */
  import { editor } from "$lib/editorStore.svelte";
  import { basename } from "$lib/fileService";

  function nameOf(path: string | null): string {
    return path ? basename(path) : "未命名";
  }
</script>

<div class="tabbar">
  {#each editor.tabs as tab (tab.id)}
    <button
      type="button"
      class="tab"
      class:on={tab.id === editor.activeId}
      onclick={() => editor.activate(tab.id)}
      ondblclick={() => tab.id === editor.activeId && (editor.mode = editor.mode === "preview" ? "source" : "preview")}
      title={tab.path ?? "未命名"}
    >
      <span class="name">{nameOf(tab.path)}</span>
      {#if tab.id === editor.activeId && tab.content !== tab.saved}
        <i class="dot"></i>
      {/if}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <span
        class="close"
        role="button"
        tabindex="-1"
        aria-label="关闭标签"
        onclick={(e) => {
          e.stopPropagation();
          void editor.closeTab(tab.id);
        }}
      >
        ×
      </span>
    </button>
  {/each}

  <button type="button" class="new" title="新建标签 (⌘T)" onclick={() => editor.openBlankTab("")}>
    +
  </button>
</div>

<style>
  .tabbar {
    flex: none;
    display: flex;
    align-items: stretch;
    gap: 4px;
    height: 32px;
    padding: 4px 10px 0;
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    scrollbar-width: none;
  }

  .tabbar::-webkit-scrollbar {
    display: none;
  }

  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    max-width: 180px;
    padding: 0 6px 0 12px;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  .tab:hover {
    color: var(--text);
  }

  .tab.on {
    color: var(--text);
    background: var(--bg);
    border-color: var(--border);
  }

  .tab .name {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .tab .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e5484d;
  }

  .tab .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    font-size: 13px;
    line-height: 1;
    color: var(--text-dim);
  }

  .tab .close:hover {
    color: var(--text);
    background: var(--hover);
  }

  .new {
    align-self: center;
    appearance: none;
    border: none;
    border-radius: 6px;
    width: 24px;
    height: 22px;
    font-size: 14px;
    line-height: 1;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
  }

  .new:hover {
    color: var(--text);
    background: var(--hover);
  }

  @media print {
    .tabbar {
      display: none;
    }
  }
</style>
