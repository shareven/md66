/**
 * 轻量更新器：对比 GitHub Release 最新版本号，下载对应平台安装包并打开安装。
 *
 * 不依赖 tauri-plugin-updater（那套方案需要 minisign 签名密钥和 CI 配合），
 * 直接走 GitHub Releases API + webview fetch（api.github.com / 发布产物下载
 * 均允许跨域），下载到系统"下载"目录后用 opener 打开（macOS 挂载 DMG、
 * Windows 运行安装程序、Linux 打开所在目录）。
 */
import { APP_REPO, APP_VERSION } from "./appInfo";
import { isTauri } from "./fileService";
import { editor } from "./editorStore.svelte";
import { i18n } from "./i18n.svelte";

export type UpdatePhase = "idle" | "checking" | "available" | "downloading";

interface GhAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GhRelease {
  tag_name: string;
  body: string | null;
  html_url: string;
  assets: GhAsset[];
}

function apiUrl(): string {
  try {
    const path = new URL(APP_REPO).pathname.replace(/\/+$/, "");
    return `https://api.github.com/repos${path}/releases/latest`;
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** 当前版本：Tauri 内取真实运行版本，浏览器回退到常量 */
async function currentVersion(): Promise<string> {
  if (isTauri) {
    try {
      const { getVersion } = await import("@tauri-apps/api/app");
      return await getVersion();
    } catch {
      /* fallthrough */
    }
  }
  return APP_VERSION;
}

/** 逐段数字比较（0.2.0 > 0.1.0；忽略预发布后缀） */
function isNewer(remote: string, current: string): boolean {
  const parse = (v: string) =>
    v.replace(/^v/i, "").split(/[.-]/).map((s) => parseInt(s, 10) || 0);
  const a = parse(remote);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

function platform(): "macos" | "windows" | "linux" | "other" {
  const ua = navigator.userAgent;
  if (/Mac|iPhone|iPad/.test(ua)) return "macos";
  if (/Windows/.test(ua)) return "windows";
  if (/Linux|X11/.test(ua) && !/Android/.test(ua)) return "linux";
  return "other";
}

function isArm(): boolean {
  const plat = typeof navigator.platform === "string" ? navigator.platform : "";
  return /aarch64|arm64|arm/i.test(navigator.userAgent + " " + plat);
}

/** 从 Release 资产中挑选当前平台的安装包 */
function pickAsset(assets: GhAsset[]): GhAsset | null {
  const list = assets ?? [];
  const arm = isArm();
  switch (platform()) {
    case "macos": {
      const dmgs = list.filter((a) => /\.dmg$/i.test(a.name));
      return (
        dmgs.find((a) => /universal/i.test(a.name)) ??
        (arm
          ? dmgs.find((a) => /aarch64|arm64/i.test(a.name))
          : dmgs.find((a) => /x86_64|x64/i.test(a.name))) ??
        dmgs[0] ?? null
      );
    }
    case "windows": {
      const pool = list.filter((a) => /\.exe$/i.test(a.name));
      const msi = list.filter((a) => /\.msi$/i.test(a.name));
      const cands = pool.length > 0 ? pool : msi;
      return (
        (arm
          ? cands.find((a) => /aarch64|arm64/i.test(a.name))
          : cands.find((a) => /x64|x86_64/i.test(a.name))) ??
        cands.find((a) => !/aarch64|arm64|x64|x86_64/i.test(a.name)) ??
        cands[0] ?? null
      );
    }
    case "linux": {
      const appimages = list.filter((a) => /\.AppImage$/i.test(a.name));
      return (
        (arm
          ? appimages.find((a) => /aarch64|arm64/i.test(a.name))
          : appimages.find((a) => /x86_64|amd64/i.test(a.name))) ??
        appimages[0] ?? null
      );
    }
    default:
      return null;
  }
}

async function openInBrowser(url: string): Promise<void> {
  if (isTauri) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank");
  }
}

class UpdaterStore {
  phase = $state<UpdatePhase>("idle");
  /** 最新版本号（去 v 前缀）；有值且 phase=available 表示有更新 */
  latest = $state("");
  /** 下载进度 0-100 */
  progress = $state(0);
  /** 最近一次成功检查到的 Release（供下载用，不参与渲染） */
  private release: GhRelease | null = null;

  get hasUpdate(): boolean {
    return this.latest !== "" && (this.phase === "available" || this.phase === "downloading");
  }

  /** 检查更新；manual=true（菜单/关于页触发）时把结果闪现到状态栏 */
  async check(manual = false): Promise<void> {
    if (this.phase === "checking" || this.phase === "downloading") return;
    const url = apiUrl();
    if (!url || !navigator.onLine) {
      if (manual) editor.flash(i18n.t.update.checkFailed);
      return;
    }
    this.phase = "checking";
    try {
      const res = await fetchWithTimeout(url, 8000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rel = (await res.json()) as GhRelease;
      this.release = rel;
      const remote = (rel.tag_name ?? "").replace(/^v/i, "");
      const current = await currentVersion();
      if (remote && isNewer(remote, current)) {
        this.latest = remote;
        this.phase = "available";
      } else {
        this.latest = "";
        this.phase = "idle";
        if (manual) editor.flash(i18n.t.update.upToDate);
      }
    } catch {
      // 网络不可达 / 未发布 Release（404）等：静默，保留此前已发现的新版本
      this.phase = this.hasUpdate ? "available" : "idle";
      if (manual) editor.flash(i18n.t.update.checkFailed);
    }
  }

  /** 下载安装包到"下载"目录并打开（一键下载 + 安装） */
  async downloadAndInstall(): Promise<void> {
    if (this.phase !== "available" || !this.release) return;
    const asset = pickAsset(this.release.assets);
    if (!asset) {
      await openInBrowser(this.release.html_url);
      editor.flash(i18n.t.update.fallback);
      return;
    }
    this.phase = "downloading";
    this.progress = 0;
    try {
      const data = await this.download(asset);
      const dest = await saveToDownloads(asset.name, data);
      this.phase = "available"; // 保留按钮，可再次打开安装包
      this.progress = 100;
      const { openPath, revealItemInDir } = await import("@tauri-apps/plugin-opener");
      if (platform() === "linux") {
        // AppImage 下载后未必有执行权限，打开所在目录更稳妥
        await revealItemInDir(dest);
        editor.flash(i18n.t.update.revealed);
      } else {
        // macOS 打开 DMG（挂载后拖入 Applications）；Windows 运行安装程序
        await openPath(dest);
        editor.flash(i18n.t.update.opened);
      }
    } catch {
      this.phase = "available";
      if (this.release) await openInBrowser(this.release.html_url);
      editor.flash(i18n.t.update.fallback);
    }
  }

  /** 流式下载并汇报进度 */
  private async download(asset: GhAsset): Promise<Uint8Array> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 600_000);
    try {
      const res = await fetch(asset.browser_download_url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("content-length")) || asset.size || 0;
      if (!res.body) return new Uint8Array(await res.arrayBuffer());
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        chunks.push(value);
        received += value.length;
        if (total > 0) this.progress = Math.min(99, Math.round((received / total) * 100));
      }
      const all = new Uint8Array(received);
      let off = 0;
      for (const c of chunks) {
        all.set(c, off);
        off += c.length;
      }
      return all;
    } finally {
      clearTimeout(timer);
    }
  }
}

async function saveToDownloads(name: string, data: Uint8Array): Promise<string> {
  const pathApi = await import("@tauri-apps/api/path");
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const dest = await pathApi.join(await pathApi.downloadDir(), name);
  await writeFile(dest, data);
  return dest;
}

export const updater = new UpdaterStore();

/** 启动后静默检查一次（延迟 2s 避免抢启动性能；失败不打扰） */
export function scheduleUpdateCheck(): void {
  setTimeout(() => void updater.check(false), 2000);
}
