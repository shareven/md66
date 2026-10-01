<script module lang="ts">
  export interface MenuItem {
    label?: string;
    shortcut?: string;
    action?: () => void;
    separator?: boolean;
    disabled?: boolean;
  }

  export interface MenuDef {
    label: string;
    items: MenuItem[];
  }
</script>

<script lang="ts">
  /** 顶部下拉菜单栏 */
  let { menus }: { menus: MenuDef[] } = $props();

  let openIndex = $state(-1);

  function toggle(i: number) {
    openIndex = openIndex === i ? -1 : i;
  }

  function run(item: MenuItem) {
    if (item.disabled || item.separator) return;
    openIndex = -1;
    item.action?.();
  }

  function onWindowPointerdown(e: PointerEvent) {
    // 点击菜单栏以外时关闭
    if (!(e.target as HTMLElement).closest(".menubar")) openIndex = -1;
  }
</script>

<svelte:window onpointerdown={onWindowPointerdown} onkeydown={(e) => e.key === "Escape" && (openIndex = -1)} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav class="menubar" onkeydown={(e) => e.key === "Escape" && (openIndex = -1)}>
  {#each menus as menu, i}
    <div class="menu">
      <button
        type="button"
        class:open={openIndex === i}
        onclick={() => toggle(i)}
        onpointerenter={() => openIndex >= 0 && (openIndex = i)}
      >
        {menu.label}
      </button>

      {#if openIndex === i}
        <div class="dropdown" role="menu">
          {#each menu.items as item}
            {#if item.separator}
              <hr />
            {:else}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onclick={() => run(item)}
              >
                <span class="label">{item.label}</span>
                {#if item.shortcut}<span class="kbd">{item.shortcut}</span>{/if}
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</nav>

<style>
  .menubar {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .menu {
    position: relative;
  }

  .menu > button {
    appearance: none;
    border: none;
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 12.5px;
    font-family: inherit;
    color: var(--text-dim);
    background: transparent;
    cursor: pointer;
    transition:
      color 0.12s,
      background-color 0.12s;
  }

  .menu > button:hover,
  .menu > button.open {
    color: var(--text);
    background: var(--hover);
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 100;
    min-width: 220px;
    padding: 5px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-raised);
    box-shadow: 0 8px 24px rgb(0 0 0 / 14%);
  }

  .dropdown button {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    width: 100%;
    appearance: none;
    border: none;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12.5px;
    font-family: inherit;
    text-align: left;
    color: var(--text);
    background: transparent;
    cursor: pointer;
  }

  .dropdown button:hover:not(:disabled) {
    background: var(--hover);
  }

  .dropdown button:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .dropdown .kbd {
    flex: none;
    font-size: 11px;
    color: var(--text-dim);
  }

  .dropdown hr {
    margin: 5px 8px;
    border: none;
    border-top: 1px solid var(--border);
  }
</style>
