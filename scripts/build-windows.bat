@echo off
REM ============================================================
REM  md66 — Windows 打包脚本
REM  必须在 Windows 10/11 上运行（CMD 或 PowerShell 均可）
REM    前置依赖：
REM      1. Node.js 18+   (https://nodejs.org)
REM      2. yarn           (npm i -g yarn)
REM      3. Rust toolchain (https://rustup.rs — 选 MSVC 稳定版)
REM      4. Visual Studio 2022 构建工具（MSVC + Windows 10 SDK）
REM      5. WebView2 Runtime（Win11 自带，Win10 需单独装）
REM  输出：NSIS 安装包 (.exe) + MSIX
REM ============================================================
setlocal enabledelayedexpansion

REM Tauri 2 CLI 在 CI=true 环境下会报 --ci 参数错误，本地构建强制关掉
set CI=false

REM ---- 平台检测 ----
if not "%OS%"=="Windows_NT" (
    echo ❌ 错误：当前不是 Windows 系统。
    echo    这个脚本只能在 Windows 上运行。
    echo    macOS 用户请运行: ./scripts/build-macos.sh
    echo    Linux  用户请运行: ./scripts/build-linux.sh
    exit /b 1
)
echo ✅ 平台检测通过：Windows

REM ---- 前置依赖检查 ----
where node >nul 2>&1 || ( echo ❌ 缺少 node，请先安装 Node.js 18+ && exit /b 1 )
where yarn >nul 2>&1 || ( echo ❌ 缺少 yarn，请运行: npm i -g yarn && exit /b 1 )
where cargo >nul 2>&1 || ( echo ❌ 缺少 cargo，请先安装 Rust: https://rustup.rs && exit /b 1 )

echo.
echo ==^> [1/5] 同步 Vditor 离线资源
node scripts\sync-vditor-assets.mjs
if errorlevel 1 goto :error

echo ==^> [2/5] 前端生产构建
call yarn build
if errorlevel 1 goto :error

echo ==^> [3/5] Rust 检查
cd src-tauri
cargo check --release 2>&1
if errorlevel 1 goto :error
cd ..

echo ==^> [4/5] Tauri 打包（NSIS + MSIX）
call yarn tauri build --bundles nsis,msix 2>&1
if errorlevel 1 goto :error

echo ==^> [5/5] 复制到桌面（带版本号）
for /f "usebackq delims=" %%v in (`node -p "require('./src-tauri/tauri.conf.json').version"`) do set "VERSION=%%v"
set "DESKTOP=%USERPROFILE%\Desktop"
if not exist "%DESKTOP%" set "DESKTOP=%USERPROFILE%\OneDrive\Desktop"
copy /Y "src-tauri\target\release\bundle\nsis\*-setup.exe" "%DESKTOP%\md66_%VERSION%_x64-setup.exe" >nul
copy /Y "src-tauri\target\release\bundle\msix\*.msix" "%DESKTOP%\md66_%VERSION%_x64.msix" >nul
dir /b "%DESKTOP%\md66_%VERSION%_*" 2>nul

echo.
echo 🎉 Windows 打包完成！安装包已复制到桌面（md66_%VERSION%_x64-setup.exe 等）。
goto :eof

:error
echo.
echo ❌ 打包失败，请查看上方错误信息。
exit /b 1
