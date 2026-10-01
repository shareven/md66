/**
 * CodeMirror 查找高亮扩展（VSCode 风格）。
 * FindBar 把 {query, matches, current} 通过 effect 推进来，
 * 编辑器为每处匹配渲染装饰类，样式在 FindBar 中定义。
 */
import { Decoration, EditorView } from "@codemirror/view";
import type { Range } from "@codemirror/state";
import { StateEffect, StateField } from "@codemirror/state";

export interface FindState {
  query: string;
  /** 源文本中所有匹配的起点 */
  matches: number[];
  /** 当前项下标 */
  current: number;
}

export const setFindState = StateEffect.define<FindState>();

const findField = StateField.define<FindState>({
  create: () => ({ query: "", matches: [], current: 0 }),
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(setFindState)) value = e.value;
    }
    return value;
  },
});

const findDecorations = EditorView.decorations.compute([findField], (state) => {
  const { query, matches, current } = state.field(findField);
  if (!query || matches.length === 0) return Decoration.none;
  const ranges: Range<Decoration>[] = [];
  matches.forEach((from, i) => {
    const cls = i === current ? "cm-md66-find-cur" : "cm-md66-find";
    ranges.push(Decoration.mark({ class: cls }).range(from, from + query.length));
  });
  return Decoration.set(ranges);
});

export const findHighlight = [findField, findDecorations];
