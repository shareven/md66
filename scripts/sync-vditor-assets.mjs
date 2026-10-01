// 将 vditor 的运行时资源复制到 static/vditor/dist，供桌面环境离线使用。
// PreviewPane 中通过 Vditor 的 cdn 选项指向本地路径。
// 未复制的目录（mathjax/echarts/graphviz 等低频渲染引擎）不影响基础编辑。
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules/vditor/dist");
const dest = join(process.cwd(), "static/vditor/dist");

if (!existsSync(src)) {
  console.error("未找到 node_modules/vditor/dist，请先安装依赖（yarn install）");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

const items = [
  "js/i18n", // 界面语言（初始化必需，缺失时编辑器无法启动）
  "js/lute", // Markdown 解析引擎（ir/wysiwyg 模式必需）
  "js/icons", // 界面图标
  "js/highlight.js", // 代码块高亮
  "js/katex", // 数学公式渲染
  "js/mermaid", // 流程图 / 时序图
  "css", // 内容主题样式
  "images", // 表情等图片
];

for (const item of items) {
  cpSync(join(src, item), join(dest, item), { recursive: true });
}

console.log(`vditor assets synced -> ${dest}`);
