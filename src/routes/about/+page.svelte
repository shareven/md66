<script lang="ts">
  import { isTauri } from "$lib/fileService";
  import { APP_NAME, APP_REPO, APP_VERSION } from "$lib/appInfo";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";
  import { updater } from "$lib/updater.svelte";

  async function openRepo() {
    if (isTauri) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(APP_REPO);
    } else {
      window.open(APP_REPO, "_blank");
    }
  }

  function onUpdateClick() {
    if (updater.hasUpdate) void updater.downloadAndInstall();
    else void updater.check(true);
  }
</script>

<svelte:head>
  <title>{i18n.t.about.title} — {APP_NAME}</title>
</svelte:head>

<div class="page" class:dark={editor.dark}>
  <header>
    <a href="/" class="back">{i18n.t.about.back}</a>
    <span class="title">{i18n.t.about.title}</span>
  </header>

  <main>
    <img class="logo" src="/favicon.png" alt={i18n.t.about.logoAlt(APP_NAME)} />

    <h1>{APP_NAME}</h1>
    <p class="version">{i18n.t.about.version(APP_VERSION)}</p>
    <p class="tagline">{i18n.t.about.tagline}</p>

    <p class="desc">
      {i18n.t.about.desc1}<br />
      {i18n.t.about.desc2}
    </p>

    <ul class="speed">
      <li>{i18n.t.about.speed1}</li>
      <li>{i18n.t.about.speed2}</li>
      <li>{i18n.t.about.speed3}</li>
    </ul>

    <p class="privacy">{i18n.t.about.privacy}</p>

    <div class="btns">
      <button type="button" onclick={openRepo}>
        <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
          />
        </svg>
        {APP_REPO.replace("https://", "")}
      </button>
      <button
        type="button"
        class="update"
        onclick={onUpdateClick}
        disabled={updater.phase === "checking" || updater.phase === "downloading"}
      >
        {#if updater.phase === "downloading"}
          ↓ {i18n.t.update.downloading(updater.progress)}
        {:else if updater.hasUpdate}
          ↓ {i18n.t.about.install(updater.latest)}
        {:else if updater.phase === "checking"}
          {i18n.t.update.checking}
        {:else}
          {i18n.t.about.checkUpdate}
        {/if}
      </button>
    </div>

    <p class="license">{i18n.t.about.license}</p>
  </main>
</div>

<style>
  :global(html),
  :global(body) {
    margin: 0;
    height: 100%;
  }

  .page {
    --bg: #ffffff;
    --bg-header: #f7f7f8;
    --border: #e3e3e6;
    --text: #1f2328;
    --text-dim: #6e7480;
    --accent: #316ef4;
    --accent-text: #ffffff;
    --bg-raised: #f7f7f8;

    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg);
    color: var(--text);
    font-family:
      -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
      "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }

  .page.dark {
    --bg: #1e2023;
    --bg-header: #24262a;
    --border: #34363b;
    --text: #d7dae0;
    --text-dim: #8b909b;
    --accent: #5b8cff;
    --accent-text: #0d1117;
    --bg-raised: #2a2d31;
  }

  header {
    flex: none;
    height: 42px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    background: var(--bg-header);
    border-bottom: 1px solid var(--border);
  }

  .back {
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
  }

  .back:hover {
    text-decoration: underline;
  }

  .title {
    font-size: 13px;
    color: var(--text-dim);
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 24px;
    text-align: center;
  }

  .logo {
    width: 88px;
    height: 88px;
    border-radius: 20px;
    margin-bottom: 10px;
    box-shadow: 0 8px 28px rgb(0 0 0 / 16%);
  }

  h1 {
    margin: 0;
    font-size: 26px;
    letter-spacing: 0.02em;
  }

  .version {
    margin: 0;
    font-size: 13px;
    color: var(--text-dim);
  }

  .tagline {
    margin: 6px 0 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--accent);
  }

  .desc {
    margin: 12px 0 14px;
    font-size: 13.5px;
    line-height: 1.8;
    color: var(--text-dim);
  }

  .speed {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin: 0 0 20px;
    padding: 0;
    list-style: none;
  }

  .speed li {
    padding: 5px 12px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--bg-raised);
    font-size: 12px;
    color: var(--text-dim);
  }

  .privacy {
    margin: 0 0 20px;
    font-size: 12px;
    color: var(--text-dim);
  }

  .btns {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 13px;
    font-family: inherit;
    color: var(--accent);
    background: var(--bg-raised);
    cursor: pointer;
    transition: border-color 0.15s;
  }

  button:hover:not(:disabled) {
    border-color: var(--accent);
  }

  button:disabled {
    cursor: default;
    opacity: 0.7;
  }

  .update {
    color: #ffffff;
    background: #1f883d;
    border-color: #1f883d;
  }

  .update:hover:not(:disabled) {
    background: #1a7f37;
    border-color: #1a7f37;
  }

  .license {
    margin-top: 26px;
    font-size: 11.5px;
    color: var(--text-dim);
  }
</style>
