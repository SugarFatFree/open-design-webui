import { execFile } from "node:child_process";
import { chmod, cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import {
  assembleNodeApp,
  buildWorkspaceArtifacts,
  collectWorkspaceTarballs,
  copyResourceTree,
  readPackagedVersion,
} from "./assemble.js";
import { ToolPackCache } from "./cache.js";
import type { ToolPackArch, ToolPackConfig, ToolPackPlatform } from "./config.js";
import { webuiResourcesRoot, winResources } from "./resources.js";
import { ensureWorkspaceBuildArtifacts } from "./workspace-build.js";

const execFileAsync = promisify(execFile);

export type WebuiArchiveKind = "zip" | "tar.gz";

// Linux distributions ship a gzipped tarball (preserves the executable bit on
// the launcher and is the native expectation for `tar xzf`); macOS and Windows
// ship a zip (the macOS `Open Design WebUI.command` and the Windows `.bat` are
// the user-facing entry points and zip is the platform-native archive there).
export function webuiArchiveKind(platform: ToolPackPlatform): WebuiArchiveKind {
  return platform === "linux" ? "tar.gz" : "zip";
}

export function webuiArchiveName(input: {
  platform: ToolPackPlatform;
  arch: ToolPackArch;
  version: string;
}): string {
  const ext = webuiArchiveKind(input.platform);
  return `open-design-webui-${input.version}-${input.platform}-${input.arch}.${ext}`;
}

// Maps the tools-pack platform/arch identity onto the prebuild-install
// `--platform`/`--arch` (Node `process.platform`/`process.arch`) values used to
// fetch the matching better-sqlite3 N-API prebuild. WebUI requires the user's
// system Node 24, so better-sqlite3 is the only platform-specific binary.
export function prebuiltSqliteTarget(
  platform: ToolPackPlatform,
  arch: ToolPackArch,
): { platform: "darwin" | "linux" | "win32"; arch: ToolPackArch } {
  const map = { mac: "darwin", linux: "linux", win: "win32" } as const;
  return { platform: map[platform], arch };
}

export type WebuiBuildResult = {
  platform: ToolPackPlatform;
  arch: ToolPackArch;
  archivePath: string;
  stageRoot: string;
};

// Ensures the assembled app carries the better-sqlite3 native binary for the
// *target* platform/arch.
//
// Native build (target === host): the production `npm install` already ran
// better-sqlite3's install script (`prebuild-install || node-gyp rebuild`),
// which fetched/compiled the matching binary for this host. Nothing to do —
// this is the path every CI matrix entry takes (each target builds on its own
// runner). Critically, this also avoids invoking the `.bin/prebuild-install`
// POSIX shim, which Windows `node` cannot execute directly.
//
// Cross build (host != target): explicitly fetch the target prebuild by running
// prebuild-install's JS entry through node (works regardless of host shell).
export async function installPrebuiltSqlite(
  appRoot: string,
  platform: ToolPackPlatform,
  arch: ToolPackArch,
): Promise<void> {
  const target = prebuiltSqliteTarget(platform, arch);
  if (target.platform === process.platform && target.arch === process.arch) {
    return;
  }
  const sqliteDir = join(appRoot, "node_modules", "better-sqlite3");
  const prebuildInstallJs = join(appRoot, "node_modules", "prebuild-install", "bin.js");
  try {
    await execFileAsync(
      process.execPath,
      [prebuildInstallJs, "--platform", target.platform, "--arch", target.arch, "--napi"],
      { cwd: sqliteDir },
    );
  } catch (error) {
    throw new Error(
      `failed to fetch better-sqlite3 prebuild for ${target.platform}/${target.arch}: ` +
        `${(error as Error).message}. 该 os/arch 可能无预编译包。`,
    );
  }
}

// Compresses the staged WebUI distribution into the platform-native archive.
// Linux uses gzip-tar; Windows prefers the bundled 7-Zip (deterministic,
// dependency-free) and macOS uses the system `zip`.
export async function createWebuiArchive(
  stageRoot: string,
  archivePath: string,
  kind: WebuiArchiveKind,
  sevenZipExe: string | null,
): Promise<void> {
  await mkdir(dirname(archivePath), { recursive: true });
  await rm(archivePath, { force: true });
  if (kind === "tar.gz") {
    await execFileAsync("tar", ["-czf", archivePath, "-C", stageRoot, "."]);
  } else if (sevenZipExe != null) {
    await execFileAsync(sevenZipExe, ["a", "-tzip", "-mx=5", archivePath, "./*"], { cwd: stageRoot });
  } else {
    await execFileAsync("zip", ["-r", "-q", archivePath, "."], { cwd: stageRoot });
  }
  await stat(archivePath);
}

export async function buildPackedWebui(config: ToolPackConfig): Promise<WebuiBuildResult> {
  const platform = config.platform;
  const arch = config.arch;
  const version = await readPackagedVersion(config);

  // 1) ensure workspace build artifacts (web server-mode + daemon dist + packaged
  //    dist) via the shared builder, routed through the cached
  //    ensureWorkspaceBuildArtifacts path the mac/win lanes use.
  const cache = new ToolPackCache(config.roots.cacheRoot);
  await ensureWorkspaceBuildArtifacts(config, cache, async () => {
    await buildWorkspaceArtifacts(config);
  });

  const baseDir = join(config.roots.output.namespaceRoot, "webui", `${platform}-${arch}`);
  const stageRoot = join(baseDir, "stage");
  const appRoot = join(stageRoot, "app");
  const resourceRoot = join(appRoot, "resources", "open-design");
  const tarballsRoot = join(baseDir, "tarballs");
  await rm(stageRoot, { force: true, recursive: true });
  await mkdir(appRoot, { recursive: true });

  // 2) assemble node app + production install
  const packed = await collectWorkspaceTarballs(config, tarballsRoot);
  await assembleNodeApp({ config, appRoot, tarballsRoot, packed });

  // 3) bundled resources WITHOUT bundling node (webui requires system node)
  await copyResourceTree(config, resourceRoot, { includeNodeBinary: false });

  // 4) target-platform better-sqlite3 prebuild
  await installPrebuiltSqlite(appRoot, platform, arch);

  // 5) copy webui launcher scripts / wrappers / config example / README
  for (const name of ["open-design.sh", "open-design.cmd", "webui.config.example.json", "README.md"]) {
    await cp(join(webuiResourcesRoot, name), join(stageRoot, name));
  }
  await chmod(join(stageRoot, "open-design.sh"), 0o755);
  if (platform === "mac") {
    await cp(join(webuiResourcesRoot, "launch-mac.command"), join(stageRoot, "Open Design WebUI.command"));
    await chmod(join(stageRoot, "Open Design WebUI.command"), 0o755);
  } else if (platform === "win") {
    await cp(join(webuiResourcesRoot, "launch-win.bat"), join(stageRoot, "Open Design WebUI.bat"));
  } else {
    await cp(join(webuiResourcesRoot, "open-design-webui.desktop"), join(stageRoot, "open-design-webui.desktop"));
  }

  // 6) archive
  const kind = webuiArchiveKind(platform);
  const archivePath = join(config.roots.output.platformRoot, webuiArchiveName({ platform, arch, version }));
  const sevenZip = platform === "win" ? winResources.sevenZipExe : null;
  await createWebuiArchive(stageRoot, archivePath, kind, sevenZip);

  return { platform, arch, archivePath, stageRoot };
}
