<script lang="ts">
  import { onMount } from "svelte";
  import Vditor from "vditor";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import "vditor/dist/index.css";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";
  import { isTauri, resolveRelative } from "$lib/fileService";

  /** 当前 Markdown 内容（双向绑定） */
  let {
    value = $bindable(""),
    active = false,
    dark = false,
    fontPx = 16,
    /** markdown 文件所在目录（解析相对图片路径） */
    assetDir = null as string | null,
  } = $props();

  let host: HTMLDivElement;
  let vditor: Vditor | null = null;
  // vditor 初始化是异步的（需加载本地 i18n / lute），完成前不能调用实例方法
  let ready = $state(false);
  let pendingSync = false;

  /** 将 markdown 中的相对图片路径转换为本地 asset 协议 URL */
  function resolveImages() {
    if (!isTauri || !assetDir) return;
    host.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || /^(https?:|data:|blob:|asset:)/i.test(src)) return;
      img.src = convertFileSrc(resolveRelative(assetDir, src));
    });
  }

  onMount(() => {
    vditor = new Vditor(host, {
      // ir: 即时渲染，Typora 式的所见即所得编辑
      mode: "ir",
      value,
      height: "100%",
      cache: { enable: false },
      toolbar: [],
      toolbarConfig: { hide: true },
      placeholder: "",
      // 界面语言跟随系统（语言包已随 vditor 资源本地化，离线可用）
      lang: i18n.lang === "zh" ? "zh_CN" : "en_US",
      theme: dark ? "dark" : "classic",
      // 支持文档内 [TOC] 目录。
      // theme.current 与 hljs.style 必须在构造时传对：Vditor 的正文/代码主题是
      // 全局单例 <link>，initUI 会按这里的值加载 CSS。若依赖 ready 后 setTheme
      // 补救，冷启动下被销毁的旧实例（{#key} 重挂载）仍会按默认 "light" 重写
      // 全局链接，造成"深色背景黑字"。构造时写对后，迟到实例写入的是相同
      // href，setContentTheme 检测到 href 未变化会跳过，竞态被消除。
      preview: {
        markdown: { toc: true },
        theme: { current: dark ? "dark" : "light" },
        hljs: { style: dark ? "github-dark" : "github" },
      },
      // 指向本地资源（scripts/sync-vditor-assets.mjs 已复制到 static/vditor/dist）
      cdn: `${location.origin}/vditor`,
      input: (md) => {
        if (active) value = md;
        setTimeout(resolveImages, 50);
      },
      after: () => {
        ready = true;
        if (active) {
          if (pendingSync) vditor?.setValue(value, true);
          vditor?.focus();
          pendingSync = false;
        }
        resolveImages();
      },
    });

    // 注册"在光标处插入"（图片粘贴 / TOC 等由 store 调用）
    editor.inserters.preview = (text) => vditor?.insertValue(text);

    return () => {
      editor.inserters.preview = undefined;
      vditor?.destroy();
      vditor = null;
    };
  });

  // 激活或内容被外部替换（如打开文件、切换标签）时，同步到编辑器
  $effect(() => {
    if (!active) return;
    const text = value;
    if (ready && vditor) {
      if (vditor.getValue() !== text) {
        vditor.setValue(text, true);
        setTimeout(resolveImages, 50);
      }
    } else {
      pendingSync = true;
    }
  });

  // 激活时聚焦
  $effect(() => {
    if (active && ready && vditor) vditor.focus();
  });

  // 跟随深浅色主题（初始化完成后才可调用）
  $effect(() => {
    const isDark = dark;
    if (!ready || !vditor) return;
    vditor.setTheme(
      isDark ? "dark" : "classic",
      isDark ? "dark" : "light",
      isDark ? "github-dark" : "github",
    );
  });
</script>

<div
  bind:this={host}
  class="preview-pane"
  style="font-size: {fontPx}px"
  onkeydowncapture={(e) => {
    // 压制 Vditor 内置的 ⌘F 搜索（底部弹层），统一使用自研查找栏
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
      e.preventDefault();
      e.stopPropagation();
      editor.findOpen = true;
    }
  }}
></div>

<style>
  .preview-pane {
    height: 100%;
    overflow: hidden;
  }

  /* 内容铺满编辑区，与源码模式一致 */
  .preview-pane :global(.vditor-ir pre.vditor-reset),
  .preview-pane :global(.vditor-ir .vditor-reset) {
    width: 100%;
    margin: 0;
    box-sizing: border-box;
    /* !important：覆盖 Vditor resize 回调写入的内联 padding。
       它按 (容器宽-768)/2 设 padding，会把内容挤得越来越窄 */
    padding: 24px 32px 40vh !important;
  }
</style>
