<script lang="ts">
  import { onMount } from "svelte";
  import { EditorView, keymap } from "@codemirror/view";
  import { Compartment, EditorState, Prec } from "@codemirror/state";
  import { basicSetup } from "codemirror";
  import { indentWithTab } from "@codemirror/commands";
  import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
  import { languages } from "@codemirror/language-data";
  import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
  import { tags as t } from "@lezer/highlight";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { editor } from "$lib/editorStore.svelte";
  import { findHighlight } from "$lib/findExtension";

  /** 亮色语法配色（GitHub Light 风格）：标题蓝、强调橙、链接青、代码块按语言高亮 */
  const lightHighlight = syntaxHighlighting(
    HighlightStyle.define([
      // Markdown 标记符号（# ** - 等）统一淡灰
      { tag: [t.meta, t.processingInstruction], color: "#8c959f" },
      // Markdown 元素
      { tag: t.heading, color: "#0550ae", fontWeight: "600" },
      { tag: t.strong, color: "#953800", fontWeight: "700" },
      { tag: t.emphasis, color: "#953800", fontStyle: "italic" },
      { tag: t.strikethrough, color: "#6e7781", textDecoration: "line-through" },
      { tag: t.link, color: "#0969da", textDecoration: "underline" },
      { tag: t.url, color: "#0a3069" },
      { tag: t.monospace, color: "#0550ae" },
      { tag: [t.quote, t.list], color: "#116329" },
      // 内嵌代码块（语言自动识别）
      { tag: [t.keyword, t.moduleKeyword, t.controlKeyword], color: "#cf222e" },
      { tag: [t.string, t.special(t.string)], color: "#0a3069" },
      { tag: [t.number, t.bool, t.null], color: "#0550ae" },
      { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
      { tag: [t.typeName, t.className, t.tagName], color: "#116329" },
      {
        tag: [
          t.function(t.variableName),
          t.definition(t.variableName),
          t.propertyName,
          t.attributeName,
          t.labelName,
        ],
        color: "#8250df",
      },
    ]),
  );

  /** 当前 Markdown 内容（双向绑定） */
  let { value = $bindable(""), active = false, dark = false, fontPx = 16 } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const themeComp = new Compartment();

  function makeState(doc: string): EditorState {
    return EditorState.create({
      doc,
      extensions: [
        // 禁用 CodeMirror 内置搜索快捷键（⌘F/F3/⌘G），统一走自研查找栏；
        // 返回 true 阻止默认行为，事件仍冒泡到 window 的查找快捷键处理
        Prec.highest(
          keymap.of([
            { key: "Mod-f", run: () => true },
            { key: "F3", run: () => true },
            { key: "Mod-g", run: () => true },
          ]),
        ),
        basicSetup,
        keymap.of([indentWithTab]),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        themeComp.of(dark ? oneDark : lightHighlight),
        findHighlight,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) value = update.state.doc.toString();
        }),
      ],
    });
  }

  onMount(() => {
    view = new EditorView({ parent: host, state: makeState(value) });
    if (active) view.focus();

    // 暴露视图与"在光标处插入"（大纲跳转 / 查找 / 图片粘贴由 store 调用）
    editor.cmView = view;
    editor.inserters.source = (text) => {
      const pos = view?.state.selection.main.head ?? 0;
      view?.dispatch({
        changes: { from: pos, to: view.state.selection.main.to, insert: text },
        selection: { anchor: pos + text.length },
        scrollIntoView: true,
      });
      view?.focus();
    };

    return () => {
      editor.inserters.source = undefined;
      editor.cmView = null;
      view?.destroy();
      view = null;
    };
  });

  // 激活或内容被外部替换（打开文件、切换标签、全部替换）时：
  // 整体重建状态（清空撤销栈，避免跨标签串扰）
  $effect(() => {
    if (!active || !view) return;
    const text = value;
    if (view.state.doc.toString() !== text) {
      const selection = view.state.selection;
      view.setState(makeState(text));
      view.dispatch({ selection });
    }
  });

  // 激活时聚焦并重新测量（此前容器处于隐藏状态）
  $effect(() => {
    if (active && view) {
      view.focus();
      view.requestMeasure();
    }
  });

  // 跟随深浅色主题
  $effect(() => {
    const isDark = dark;
    view?.dispatch({
      effects: themeComp.reconfigure(isDark ? oneDark : lightHighlight),
    });
  });
</script>

<div bind:this={host} class="source-pane" style="font-size: {fontPx}px"></div>

<style>
  .source-pane {
    height: 100%;
    overflow: hidden;
  }

  .source-pane :global(.cm-editor) {
    height: 100%;
  }

  .source-pane :global(.cm-scroller) {
    font-family:
      ui-monospace,
      "SF Mono",
      SFMono-Regular,
      Menlo,
      Consolas,
      "Liberation Mono",
      monospace;
  }
</style>
