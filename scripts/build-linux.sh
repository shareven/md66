#!/usr/bin/env bash
# ============================================================
# md66 — Linux 打包脚本
# 必须在 Linux 上运行（推荐 Ubuntu 22.04 / Debian 12 / Fedora 38+）
#   前置依赖（Ubuntu/Debian）：
#     sudo apt install build-essential curl wget file \
#       libxdo-dev libssl-dev libayatana-appindicator3-dev \
#       librsvg2-dev libwebkit2gtk-4.1-dev
# 输出：.deb + AppImage
# ============================================================
set -euo pipefail

# Tauri 2 CLI 在 CI=true 环境下会报 --ci 参数错误，本地构建强制关掉
export CI=false

# ---- 平台检测 ----
OS="$(uname -s)"
if [ "$OS" != "Linux" ]; then
  echo "❌ 错误：当前系统是 $OS，不是 Linux。"
  echo "   这个脚本只能在 Linux 上运行。"
  echo "   macOS  用户请运行: ./scripts/build-macos.sh"
  echo "   Windows 用户请运行: .\scripts\build-windows.bat"
  exit 1
fi
echo "✅ 平台检测通过：Linux ($(uname -m))"

# ---- 前置依赖检查 ----
command -v node >/dev/null 2>&1 || { echo "❌ 缺少 node，请先安装 Node.js 18+"; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "❌ 缺少 yarn，请运行: npm i -g yarn"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "❌ 缺少 cargo，请先安装 Rust: https://rustup.rs"; exit 1; }
dpkg -s libwebkit2gtk-4.1-dev >/dev/null 2>&1 || \
  echo "⚠️  提示：libwebkit2gtk-4.1-dev 未检测到，打包可能失败。安装命令：" && \
  echo "    sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev"

echo ""
echo "==> [1/5] 同步 Vditor 离线资源"
node scripts/sync-vditor-assets.mjs

echo "==> [2/5] 前端生产构建"
yarn build

echo "==> [3/5] Rust 检查"
cd src-tauri
cargo check --release 2>&1 | tail -5
cd ..

echo "==> [4/5] Tauri 打包（deb + AppImage）"
yarn tauri build --bundles deb,appimage 2>&1 | tail -30

echo "==> [5/5] 复制到桌面（带版本号）"
VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
# Linux 桌面路径可能是 Desktop 或 桌面，优先用 XDG 标准
DESKTOP="${XDG_DESKTOP_DIR:-$HOME/Desktop}"
[ ! -d "$DESKTOP" ] && DESKTOP="$HOME/桌面"
[ ! -d "$DESKTOP" ] && DESKTOP="$HOME"
cp -f src-tauri/target/release/bundle/deb/*.deb "$DESKTOP/md66_${VERSION}_amd64.deb" 2>/dev/null || true
cp -f src-tauri/target/release/bundle/appimage/*.AppImage "$DESKTOP/md66_${VERSION}_amd64.AppImage" 2>/dev/null || true
ls -lh "$DESKTOP"/md66_${VERSION}_* 2>/dev/null

echo ""
echo "🎉 Linux 打包完成！安装包已复制到 $DESKTOP（md66_${VERSION}_amd64.deb / .AppImage）"
