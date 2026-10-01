# md66

![Version](https://img.shields.io/badge/version-0.1.0-316ef4) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![License](https://img.shields.io/badge/license-MIT-green)
![Downloads](https://img.shields.io/github/downloads/shareven/md66/total) |

一款开源免费跨平台 Markdown 编辑器，支持 **macOS**、**Windows** 和 **Linux**。

基于 Tauri 2 + Svelte 5 构建：预览模式使用 [Vditor](https://github.com/Vanessa219/vditor) 即时渲染引擎，源码模式使用 [CodeMirror 6](https://codemirror.net/)。

## 下载 | Download

 [Release](https://github.com/shareven/parcel/releases/) 

## 功能特性

### 双模式编辑

- **预览模式**：即时渲染，直接在排版后的富文本上编辑（Typora 式体验）

- **源码模式**：编辑原始 Markdown 文本，语法高亮、行号、代码折叠

- 两种模式内容实时互通，随时切换（⌘/ / Ctrl+/）

### 文件与保存

- 打开 / 保存 / 另存为（`.md` / `.markdown` / `.txt`）

- **自动保存**：关联文件后修改自动写盘；未关联时自动保存草稿，重启恢复

- 多标签页，未保存修改标记（标题栏红点），关闭窗口前确认

- 最近打开的文件列表

- 外部修改检测（文件被其他程序改动时提示重载）

- 拖拽 `.md` / `.txt` 文件到窗口直接打开

### 导出

- PDF（系统打印对话框中选择"存储为 PDF"）

- Word（.doc）

- PNG 长图

- 打印

### 编辑辅助

- 查找替换（⌘F，支持全部替换、逐处定位）

- 大纲面板（⌘⇧O，标题导航点击跳转）

- 字数统计（字 / 字符 / 行）

- 字号调节（⌘+ / ⌘- / ⌘0，记忆设置）

- 粘贴 / 拖拽图片自动存入文件旁 `assets/` 目录并插入引用

- 生成目录（\[TOC]）

- 命令面板（⌘⇧P）

- 多窗口（⌘N）

### 渲染支持

- GFM 表格、任务列表、脚注、删除线、高亮

- 代码块语法高亮（代码语言自动识别）

- 数学公式（KaTeX）、流程图 / 时序图（Mermaid）

- 本地图片显示（asset 协议，离线可用）

### 其他

- 跟随系统深浅色主题

- Markdown 语法说明页（帮助菜单）

- 编辑器资源全部本地化，**离线可用**

- 简体中文界面

## 快捷键

| 快捷键（macOS / Windows） | 功能             |
| -------------------- | -------------- |
| ⌘/ / Ctrl+/          | 切换预览 / 源码模式    |
| ⌘N / Ctrl+N          | 新建窗口           |
| ⌘T / Ctrl+T          | 新建标签           |
| ⌘W / Ctrl+W          | 关闭标签           |
| ⌘O / Ctrl+O          | 打开文件           |
| ⌘S / Ctrl+S          | 保存             |
| ⌘⇧S / Ctrl+Shift+S   | 另存为            |
| ⌘F / Ctrl+F          | 查找替换           |
| ⌘⇧O / Ctrl+Shift+O   | 大纲面板           |
| ⌘⇧P / Ctrl+Shift+P   | 命令面板           |
| ⌘P / Ctrl+P          | 打印             |
| ⌘+ / ⌘- / ⌘0         | 放大 / 缩小 / 重置字号 |

## 环境要求

- [Node.js](https://nodejs.org/) 18+ 与 [yarn](https://yarnpkg.com/)（或 npm）

- [Rust](https://www.rust-lang.org/) 1.77.2+（`rustup update stable` 升级）

Linux 需额外安装系统依赖（以 Ubuntu / Debian 为例）：

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Fedora / Arch 等发行版依赖见 [Tauri 官方文档](https://tauri.app/start/prerequisites/)。

## 开发与构建

```bash
# 1. 安装依赖
yarn install

# 2. 开发模式运行（热更新）
yarn tauri dev
```

### 打包

三个打包脚本分别对应三个平台，每个脚本会自动检查平台是否匹配、前置依赖是否齐全，不匹配会报错并提示正确用法。

> ⚠️ **Tauri 不能跨平台打包**——在哪个系统上就只能出那个系统的包。Windows `.exe` 必须在 Windows 上打，`.dmg` 必须在 macOS 上打。

| 平台 | 运行命令 | 产物 |
|---|---|---|
| **macOS** | `./scripts/build-macos.sh` | `.dmg`（universal，ARM64 + x86_64） |
| **Windows** | `scripts\build-windows.bat`（CMD / PowerShell） | NSIS `.exe` 安装包 + `.msix` |
| **Linux** | `./scripts/build-linux.sh` | `.deb` + AppImage |

所有产物输出到 `src-tauri/target/release/bundle/` 下对应子目录。

如需手动执行原始命令（等价于脚本内部做的事）：

```bash
# macOS（universal 通用包，同时支持 ARM64 + x86_64）
yarn build && yarn tauri build --target universal-apple-darwin --bundles dmg

# Windows（NSIS 安装包）
yarn build && yarn tauri build --bundles nsis,msix

# Linux（deb + AppImage）
yarn build && yarn tauri build --bundles deb,appimage
```

## 项目结构

```
src/                      前端（SvelteKit）
  lib/
    components/           编辑器、菜单栏、标签栏、大纲、查找等组件
    editorStore.svelte.ts 全局编辑器状态（多标签 / 模式 / 字号）
    fileService.ts        文件读写、草稿会话、路径工具
    exporter.ts           导出 Word / 图片 / 打印
  routes/                 页面：编辑器 / 语法说明 / 关于
src-tauri/                桌面外壳（Rust / Tauri 2）
scripts/
  sync-vditor-assets.mjs  将 vditor 运行时资源同步到 static/（离线可用）
  build-macos.sh          macOS 打包脚本（含平台检测）
  build-windows.bat       Windows 打包脚本（含平台检测）
  build-linux.sh          Linux 打包脚本（含平台检测）
```

## 许可证

[MIT](./LICENSE)
