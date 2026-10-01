<script lang="ts">
  import { onMount } from "svelte";
  import Vditor from "vditor";
  import "vditor/dist/index.css";
  import { editor } from "$lib/editorStore.svelte";

  const guideMd = `# Markdown 语法说明

Markdown 是一种轻量级标记语言，用少量符号即可写出排版良好的文档。以下是最常用的写法。

## 标题

用 \`#\` 的数量表示级别（1–6 级）：

\`\`\`markdown
# 一级标题
## 二级标题
### 三级标题
\`\`\`

## 段落与换行

段落之间**空一行**。段内换行可在行末加两个空格，或直接换行（多数渲染器支持）。

## 强调

\`\`\`markdown
**粗体**  *斜体*  ***粗斜体***  ~~删除线~~  \`行内代码\`  ==高亮==
\`\`\`

效果：**粗体**、*斜体*、***粗斜体***、~~删除线~~、\`行内代码\`、==高亮==

## 列表

无序列表用 \`-\` 或 \`*\`；有序列表用数字加点；缩进两个空格嵌套：

\`\`\`markdown
- 水果
  - 苹果
  - 香蕉
1. 第一步
2. 第二步
\`\`\`

- 水果
  - 苹果
  - 香蕉

1. 第一步
2. 第二步

任务列表：

\`\`\`markdown
- [x] 已完成
- [ ] 待办
\`\`\`

- [x] 已完成
- [ ] 待办

## 引用

行首加 \`>\`，可嵌套：

\`\`\`markdown
> 这是一段引用
> > 引用中的引用
\`\`\`

> 这是一段引用
> > 引用中的引用

## 代码块

用三个反引号包围，标注语言可获得语法高亮：

\`\`\`\`markdown
\`\`\`ts
function greet(name: string) {
  return \`你好，\${name}\`;
}
\`\`\`
\`\`\`\`

## 链接与图片

\`\`\`markdown
[链接文字](https://github.com/shareven/md66)
![图片说明](assets/example.png)
\`\`\`

[md66 仓库](https://github.com/shareven/md66)

## 表格

\`\`\`markdown
| 左对齐 | 居中 | 右对齐 |
| :----- | :--: | -----: |
| a      |  b   |      c |
\`\`\`

| 左对齐 | 居中 | 右对齐 |
| :----- | :--: | -----: |
| a      |  b   |      c |

## 分隔线

三个及以上的 \`-\` 或 \`*\`：

---

## 脚注

\`\`\`markdown
Markdown[^1] 很好用。

[^1]: 一种轻量级标记语言。
\`\`\`

Markdown[^1] 很好用。

[^1]: 一种轻量级标记语言。

## 数学公式（KaTeX）

\`\`\`markdown
行内公式：$E = mc^2$

块级公式：
$$
\\int_a^b f(x)\\,dx
$$
\`\`\`

行内公式：$E = mc^2$

$$
\\int_a^b f(x)\\,dx
$$

## 流程图（Mermaid）

\`\`\`\`markdown
\`\`\`mermaid
graph LR
    A[开始] --> B{条件?}
    B -- 是 --> C[执行]
    B -- 否 --> D[结束]
\`\`\`
\`\`\`\`

\`\`\`mermaid
graph LR
    A[开始] --> B{条件?}
    B -- 是 --> C[执行]
    B -- 否 --> D[结束]
\`\`\`

## 目录

在文档任意位置写 \`[TOC]\`（md66 支持自动渲染）。

## 转义

需要显示符号本身时，前面加反斜杠：\\\` \\\* \\\# \\\_。

---

> 提示：md66 的**预览模式**下，直接输入这些语法即可即时看到排版效果。
`;

  let host: HTMLDivElement;

  onMount(async () => {
    await Vditor.preview(host, guideMd, {
      cdn: `${location.origin}/vditor`,
      mode: "dark",
      theme: { current: editor.dark ? "dark" : "light" },
      hljs: { style: editor.dark ? "github-dark" : "github", lineNumber: false },
      speech: { enable: false },
      anchor: 1,
    });
  });
</script>

<svelte:head>
  <title>Markdown 语法说明 — md66</title>
</svelte:head>

<div class="page" class:dark={editor.dark}>
  <header>
    <a href="/" class="back">‹ 返回编辑器</a>
    <span class="title">Markdown 语法说明</span>
  </header>
  <div class="content" bind:this={host}></div>
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

  .content {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 24px 32px 20vh;
  }

  .content :global(.vditor-reset) {
    max-width: 820px;
    margin: 0 auto;
    font-size: 15px;
  }
</style>
