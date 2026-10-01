<script lang="ts">
  import { isTauri } from "$lib/fileService";
  import { APP_NAME, APP_REPO, APP_VERSION } from "$lib/appInfo";
  import { editor } from "$lib/editorStore.svelte";

  async function openRepo() {
    if (isTauri) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(APP_REPO);
    } else {
      window.open(APP_REPO, "_blank");
    }
  }
</script>

<svelte:head>
  <title>关于 — {APP_NAME}</title>
</svelte:head>

<div class="page" class:dark={editor.dark}>
  <header>
    <a href="/" class="back">‹ 返回编辑器</a>
    <span class="title">关于</span>
  </header>

  <main>
    <img class="logo" src="/favicon.png" alt="{APP_NAME} 图标" />

    <h1>{APP_NAME}</h1>
    <p class="version">版本 {APP_VERSION}</p>

    <p class="desc">
      一款支持 macOS、Windows 与 Linux 的双模式 Markdown 编辑器：<br />
      预览模式即时渲染、所见即所得，源码模式轻快纯粹。
    </p>

    <button type="button" onclick={openRepo}>
      <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
        />
      </svg>
      {APP_REPO.replace("https://", "")}
    </button>

    <p class="license">MIT License · 基于 Tauri / Svelte / Vditor / CodeMirror</p>
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

  .desc {
    margin: 14px 0 18px;
    font-size: 13.5px;
    line-height: 1.8;
    color: var(--text-dim);
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

  button:hover {
    border-color: var(--accent);
  }

  .license {
    margin-top: 26px;
    font-size: 11.5px;
    color: var(--text-dim);
  }
</style>
