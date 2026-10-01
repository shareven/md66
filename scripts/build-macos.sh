#!/usr/bin/env bash
# ============================================================
# md66 — macOS 打包脚本
# 必须在 macOS 上运行
# 输出：一个 universal DMG（同时支持 ARM64 M 芯片 + x86_64 Intel）
# ============================================================
set -euo pipefail

# Tauri 2 CLI 在 CI=true 环境下会报 --ci 参数错误，本地构建强制关掉
export CI=false

# ---- 平台检测 ----
OS="$(uname -s)"
if [ "$OS" != "Darwin" ]; then
  echo "❌ 错误：当前系统是 $OS，不是 macOS。"
  echo "   这个脚本只能在 macOS 上运行。"
  echo "   Windows 用户请运行: .\scripts\build-windows.bat"
  echo "   Linux  用户请运行: ./scripts/build-linux.sh"
  exit 1
fi
echo "✅ 平台检测通过：macOS ($(uname -m))"

# ---- 前置依赖检查 ----
command -v node >/dev/null 2>&1 || { echo "❌ 缺少 node，请先安装 Node.js 18+"; exit 1; }
command -v yarn >/dev/null 2>&1 || { echo "❌ 缺少 yarn，请运行: npm i -g yarn"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "❌ 缺少 cargo，请先安装 Rust: https://rustup.rs"; exit 1; }

BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
BUILD_LOG="src-tauri/target/tauri-build.log"

# 卸载本项目残留的 DMG 挂载卷。
# bundle_dmg.sh 中途失败/被中断时，它的临时映像 bundle/macos/rw.*.dmg 会仍处于
# 挂载状态（/Volumes/dmg.*）；残留挂载会占用旧文件，导致下一次打包在
# hdiutil attach/convert 阶段报"文件已经存在""资源繁忙"等错误。
cleanup_stale_mounts() {
  local mounts
  # 兼容两种输出格式：
  #   新版: "mount-point      : /Volumes/xxx"
  #   旧版: "/dev/disk7s1  <UUID>  /Volumes/xxx"（挂载点在设备行的最后一个字段）
  mounts="$(hdiutil info | awk -v prefix="$PWD/src-tauri/target" '
    $1 == "image-path" { inproj = (index($NF, prefix) == 1) }
    $1 == "mount-point" { if (inproj) print $NF }
    $1 ~ /^\/dev\/disk/ && $NF ~ /^\/Volumes\// { if (inproj) print $NF }
  ')"
  while IFS= read -r mnt; do
    [ -n "$mnt" ] || continue
    echo "   卸载残留挂载: $mnt"
    hdiutil detach "$mnt" -force >/dev/null 2>&1 || true
  done <<< "$mounts"
}

# 标准打包（保留 Finder 图标美化），完整输出同时写入 $BUILD_LOG
tauri_build_dmg() {
  cleanup_stale_mounts
  rm -rf "$BUNDLE_DIR"
  yarn tauri build --target universal-apple-darwin --bundles dmg 2>&1 | tee "$BUILD_LOG"
}

# 兜底：绕过 tauri CLI，直接调用 bundle_dmg.sh --skip-jenkins。
# 跳过 Finder/AppleScript 美化（该步骤依赖终端被授权控制 Finder，是 DMG 打包
# 最常见的失败点），其余步骤相同，必定产出 DMG。
fallback_build_dmg_skip_jenkins() {
  local macos_dir="$BUNDLE_DIR/macos" dmg_dir="$BUNDLE_DIR/dmg"
  cleanup_stale_mounts
  rm -rf "$BUNDLE_DIR/macos/rw."*.dmg 2>/dev/null || true
  if [ ! -d "$macos_dir/md66.app" ] || [ ! -f "$dmg_dir/bundle_dmg.sh" ] || [ ! -f "$dmg_dir/icon.icns" ]; then
    echo "❌ 兜底打包缺少前置产物（md66.app / bundle_dmg.sh / icon.icns）"
    return 1
  fi
  (
    cd "$macos_dir" || exit 1
    "$dmg_dir/bundle_dmg.sh" --volname md66 --icon md66.app 180 170 \
      --app-drop-link 480 170 --window-size 660 400 --hide-extension md66.app \
      --volicon "$dmg_dir/icon.icns" --skip-jenkins \
      md66_0.1.0_universal.dmg md66.app
  )
  [ -f "$macos_dir/md66_0.1.0_universal.dmg" ] || return 1
  mv -f "$macos_dir/md66_0.1.0_universal.dmg" "$dmg_dir/md66_0.1.0_universal.dmg"
}

echo ""
echo "==> [1/5] 确保两个架构的 Rust target 已安装"
rustup target add aarch64-apple-darwin x86_64-apple-darwin 2>&1 | grep -i "info: component" || true

echo "==> [2/5] 同步 Vditor 离线资源"
node scripts/sync-vditor-assets.mjs

echo "==> [3/5] 前端生产构建"
yarn build

echo "==> [4/5] Tauri 打包（universal DMG，含 ARM64 + x86_64）"
# 注意：不要用 `| tail -10` 截断输出——它会把 bundle_dmg.sh 的真实报错吞掉。
# 完整日志写入 src-tauri/target/tauri-build.log，失败时自动重试。
if ! tauri_build_dmg; then
  echo "⚠️ 第 1 次打包失败，自动清理残留后重试（完整日志: $BUILD_LOG）"
  tail -n 30 "$BUILD_LOG" || true
  mv -f "$BUILD_LOG" "$BUILD_LOG.attempt1"
  if ! tauri_build_dmg; then
    echo "⚠️ 第 2 次仍失败，改用兜底模式：跳过 Finder 美化直接生成 DMG"
    if fallback_build_dmg_skip_jenkins; then
      echo "✅ 兜底模式打包成功（DMG 窗口图标定位为默认布局）"
    else
      echo "❌ 三次尝试均失败。请查看完整日志定位原因："
      echo "   第1次: $BUILD_LOG.attempt1"
      echo "   第2次: $BUILD_LOG"
      tail -n 40 "$BUILD_LOG" || true
      exit 1
    fi
  fi
fi

echo "==> [5/5] 复制到桌面（带版本号）"
VERSION=$(node -p "require('./src-tauri/tauri.conf.json').version")
DESKTOP="$HOME/Desktop"
DMG_PATH="src-tauri/target/universal-apple-darwin/release/bundle/dmg"
TARGET_DMG="$DESKTOP/md66_${VERSION}_universal.dmg"

# 防覆盖损坏：旧 DMG 若仍被挂载，原地覆盖会导致映像数据损坏（Finder 报 -36）
# 先卸载所有残留的 md66 挂载卷，再删除旧文件，最后复制新文件
for vol in /Volumes/md66*; do
  [ -d "$vol" ] || continue
  hdiutil detach "$vol" -force >/dev/null 2>&1 \
    && echo "   已卸载残留挂载: $vol" \
    || echo "   ⚠️ 无法卸载 $vol（请手动推出后再复制）"
done
rm -f "$DESKTOP"/md66_*.dmg
cp -f "$DMG_PATH"/*.dmg "$TARGET_DMG"
ls -lh "$TARGET_DMG"

echo ""
echo "🎉 macOS 打包完成！DMG 已复制到桌面: md66_${VERSION}_universal.dmg"
