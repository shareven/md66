<script module lang="ts">
  export interface Command {
    id: string;
    label: string;
    shortcut?: string;
    run: () => void;
  }
</script>

<script lang="ts">
  /** 命令面板（⌘⇧P）：搜索并执行菜单命令 */
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";

  let { commands }: { commands: Command[] } = $props();

  let keyword = $state("");
  let cursor = $state(0);

  let filtered = $derived(
    keyword
      ? commands.filter((c) => c.label.toLowerCase().includes(keyword.toLowerCase()))
      : commands,
  );

  function exec(cmd?: Command) {
    if (!cmd) return;
    editor.paletteOpen = false;
    keyword = "";
    cursor = 0;
    cmd.run();
  }

  function onKeydown(e: KeyboardEvent) {
    if (!editor.paletteOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      cursor = Math.min(cursor + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cursor = Math.max(cursor - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      exec(filtered[cursor]);
    } else if (e.key === "Escape") {
      editor.paletteOpen = false;
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if editor.paletteOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="mask" onclick={() => (editor.paletteOpen = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="panel"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={i18n.t.palette.aria}
      tabindex="-1"
    >
      <input
        type="text"
        placeholder={i18n.t.palette.placeholder}
        bind:value={keyword}
        oninput={() => (cursor = 0)}
      />
      <div class="list" role="listbox">
        {#each filtered as cmd, i (cmd.id)}
          <button
            type="button"
            role="option"
            aria-selected={i === cursor}
            class:on={i === cursor}
            onpointerenter={() => (cursor = i)}
            onclick={() => exec(cmd)}
          >
            <span class="label">{cmd.label}</span>
            {#if cmd.shortcut}<span class="kbd">{cmd.shortcut}</span>{/if}
          </button>
        {:else}
          <div class="empty">{i18n.t.palette.empty}</div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .mask {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    background: rgb(0 0 0 / 25%);
  }

  .panel {
    width: 460px;
    max-width: calc(100vw - 48px);
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--bg-raised);
    box-shadow: 0 16px 48px rgb(0 0 0 / 24%);
    overflow: hidden;
  }

  input {
    width: 100%;
    height: 42px;
    padding: 0 14px;
    border: none;
    border-bottom: 1px solid var(--border);
    font-size: 14px;
    font-family: inherit;
    color: var(--text);
    background: transparent;
    outline: none;
  }

  .list {
    max-height: 320px;
    overflow-y: auto;
    padding: 5px;
  }

  .list button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    width: 100%;
    appearance: none;
    border: none;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
    color: var(--text);
    background: transparent;
    cursor: pointer;
  }

  .list button.on {
    background: var(--hover);
  }

  .list .kbd {
    flex: none;
    font-size: 11px;
    color: var(--text-dim);
  }

  .empty {
    padding: 14px;
    font-size: 12.5px;
    color: var(--text-dim);
    text-align: center;
  }
</style>
