<script lang="ts">
  import { onMount } from "svelte";
  import Vditor from "vditor";
  import "vditor/dist/index.css";
  import { editor } from "$lib/editorStore.svelte";
  import { i18n } from "$lib/i18n.svelte";
  import { handleAnchorJump } from "$lib/anchorJump";

  const GUIDE_MD_ZH = `# Markdown 语法说明

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

## 目录（TOC）

在**单独一行**写 \`[TOC]\`，渲染时会自动替换为整篇文档的标题大纲，点击任一条目可直接跳转到对应章节。

\`\`\`markdown
# 项目说明

[TOC]

## 背景

## 安装

### macOS

### Windows

## 常见问题
\`\`\`

使用要点：

- \`[TOC]\` 必须**独占一行**才生效，放在代码块内则只显示文字
- 位置任意，通常放在首个大标题之后、正文开始之前
- 自动收集文档中的**全部标题**（1–6 级），并按层级缩进展示
- 预览模式下**实时更新**：标题增、删、改后目录立即跟着变化
- 标题后可附加锚点链接（如 \`## 安装\` 对应 \`#安装\`），方便在网页中直达章节
- 目录会随文档一起渲染，导出 PDF / Word / 图片时同样包含

本文档自己的目录（实际渲染效果）：

[TOC]

> 另有侧边栏**大纲面板**（⌘⇧O / Ctrl+Shift+O），不占用正文空间，随时呼出按标题导航。

## 转义

需要显示符号本身时，前面加反斜杠：\\\` \\\* \\\# \\\_。

---

> 提示：md66 的**预览模式**下，直接输入这些语法即可即时看到排版效果。
`;

  const GUIDE_MD_EN = `# Markdown Syntax Guide

Markdown is a lightweight markup language — a few symbols produce well-formatted documents. Below are the most common constructs.

## Headings

The number of \`#\` marks the level (1–6):

\`\`\`markdown
# Heading 1
## Heading 2
### Heading 3
\`\`\`

## Paragraphs & line breaks

Leave a **blank line** between paragraphs. To break a line within a paragraph, end it with two spaces, or just wrap (most renderers support it).

## Emphasis

\`\`\`markdown
**bold**  *italic*  ***bold italic***  ~~strikethrough~~  \`inline code\`  ==highlight==
\`\`\`

Renders as: **bold**, *italic*, ***bold italic***, ~~strikethrough~~, \`inline code\`, ==highlight==

## Lists

Unordered lists use \`-\` or \`*\`; ordered lists use numbers with dots; indent two spaces to nest:

\`\`\`markdown
- Fruits
  - Apple
  - Banana
1. First step
2. Second step
\`\`\`

- Fruits
  - Apple
  - Banana

1. First step
2. Second step

Task lists:

\`\`\`markdown
- [x] Done
- [ ] Todo
\`\`\`

- [x] Done
- [ ] Todo

## Blockquotes

Start a line with \`>\`; quotes can nest:

\`\`\`markdown
> This is a quote
> > A quote inside a quote
\`\`\`

> This is a quote
> > A quote inside a quote

## Code blocks

Surround with triple backticks and tag the language for syntax highlighting:

\`\`\`\`markdown
\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}\`;
}
\`\`\`
\`\`\`\`

## Links & images

\`\`\`markdown
[link text](https://github.com/shareven/md66)
![alt text](assets/example.png)
\`\`\`

[md66 repository](https://github.com/shareven/md66)

## Tables

\`\`\`markdown
| Left | Center | Right |
| :--- | :---- | ----: |
| a    |   b   |     c |
\`\`\`

| Left | Center | Right |
| :--- | :---- | ----: |
| a    |   b   |     c |

## Horizontal rule

Three or more \`-\` or \`*\`:

---

## Footnotes

\`\`\`markdown
Markdown[^1] is handy.

[^1]: A lightweight markup language.
\`\`\`

Markdown[^1] is handy.

[^1]: A lightweight markup language.

## Math (KaTeX)

\`\`\`markdown
Inline: $E = mc^2$

Block:
$$
\\int_a^b f(x)\\,dx
$$
\`\`\`

Inline: $E = mc^2$

$$
\\int_a^b f(x)\\,dx
$$

## Diagrams (Mermaid)

\`\`\`\`markdown
\`\`\`mermaid
graph LR
    A[Start] --> B{Condition?}
    B -- Yes --> C[Run]
    B -- No --> D[End]
\`\`\`
\`\`\`\`

\`\`\`mermaid
graph LR
    A[Start] --> B{Condition?}
    B -- Yes --> C[Run]
    B -- No --> D[End]
\`\`\`

## Table of contents (TOC)

Put \`[TOC]\` **on a line of its own**; on render it is replaced by an outline of every heading in the document, and clicking an entry jumps straight to that section.

\`\`\`markdown
# Project Guide

[TOC]

## Background

## Installation

### macOS

### Windows

## FAQ
\`\`\`

Usage notes:

- \`[TOC]\` must be **on its own line** to take effect; inside a code block it shows as plain text
- Place it anywhere — typically right after the main title, before the body starts
- It collects **all headings** (levels 1–6) automatically, indented by level
- Updates **live** in preview mode: add, remove, or edit a heading and the outline follows instantly
- Headings get anchor links (e.g. \`## Installation\` → \`#installation\`) for jumping straight to a section on the web
- The outline is part of the document — exports to PDF / Word / image include it too

Here is this document's own outline (live rendering):

[TOC]

> There is also the sidebar **outline panel** (⌘⇧O / Ctrl+Shift+O) — takes no body space, summon it anytime to navigate by heading.

## Escaping

Prefix these characters with a backslash to show them literally: \\\` \\\* \\\# \\\_.

---

> Tip: in md66's **preview mode**, just type these constructs and see the result instantly.
`;

  /** 当前语言的语法说明文档 */
  const guideMd = $derived(i18n.lang === "zh" ? GUIDE_MD_ZH : GUIDE_MD_EN);

  let host: HTMLDivElement;

  onMount(async () => {
    await Vditor.preview(host, guideMd, {
      cdn: `${location.origin}/vditor`,
      lang: i18n.lang === "zh" ? "zh_CN" : "en_US",
      mode: "dark",
      // toc 默认为 false，不开的话正文 [TOC] 会原样输出纯文本
      markdown: { toc: true },
      theme: { current: editor.dark ? "dark" : "light" },
      hljs: { style: editor.dark ? "github-dark" : "github", lineNumber: false },
      speech: { enable: false },
      anchor: 1,
    });
  });
</script>

<svelte:head>
  <title>{i18n.t.guide.title} — md66</title>
</svelte:head>

<div class="page" class:dark={editor.dark}>
  <header>
    <a href="/" class="back">{i18n.t.guide.back}</a>
    <span class="title">{i18n.t.guide.title}</span>
  </header>
  <div class="content" bind:this={host} onclickcapture={handleAnchorJump}></div>
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
