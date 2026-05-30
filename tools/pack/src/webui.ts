import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import {
  assembleNodeApp,
  collectWorkspaceTarballs,
  copyResourceTree,
  readPackagedVersion,
} from "./assemble.js";
import { ToolPackCache } from "./cache.js";
import type { ToolPackArch, ToolPackConfig, ToolPackPlatform } from "./config.js";
import { webuiResourcesRoot, winResources } from "./resources.js";
import { processWebSourcemaps } from "./web-sourcemaps.js";
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

// Replaces the host-arch better-sqlite3 prebuild installed by the production
// install with the prebuild for the *target* platform/arch, so a WebUI archive
// built on (say) an arm64 mac can carry the x64-linux binary the consumer needs.
export async function installPrebuiltSqlite(
  appRoot: string,
  platform: ToolPackPlatform,
  arch: ToolPackArch,
): Promise<void> {
  const target = prebuiltSqliteTarget(platform, arch);
  const sqliteDir = join(appRoot, "node_modules", "better-sqlite3");
  const prebuildInstall = join(sqliteDir, "node_modules", ".bin", "prebuild-install");
  try {
    await execFileAsync(
      process.execPath,
      [prebuildInstall, "--platform", target.platform, "--arch", target.arch, "--napi"],
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

// Mirrors buildWorkspaceArtifacts in linux.ts (server web output mode + daemon
// dist + packaged dist), but routed through the cached
// ensureWorkspaceBuildArtifacts path the mac/win lanes use.
async function buildWorkspaceArtifactsForWebui(config: ToolPackConfig): Promise<void> {
  const { createPackageManagerInvocation } = await import("@open-design/platform");
  const runPnpm = async (args: string[], extraEnv: NodeJS.ProcessEnv = {}): Promise<void> => {
    const invocation = createPackageManagerInvocation(args, process.env);
    await execFileAsync(invocation.command, invocation.args, {
      cwd: config.workspaceRoot,
      env: { ...process.env, ...extraEnv },
    });
  };

  const webNextEnvPath = join(config.workspaceRoot, "apps", "web", "next-env.d.ts");
  const previousWebNextEnv = await readFile(webNextEnvPath, "utf8").catch(() => null);

  await runPnpm(["--filter", "@open-design/contracts", "build"]);
  await runPnpm(["--filter", "@open-design/registry-protocol", "build"]);
  await runPnpm(["--filter", "@open-design/sidecar-proto", "build"]);
  await runPnpm(["--filter", "@open-design/sidecar", "build"]);
  await runPnpm(["--filter", "@open-design/platform", "build"]);
  await runPnpm(["--filter", "@open-design/host", "build"]);
  await runPnpm(["--filter", "@open-design/download", "build"]);
  await runPnpm(["--filter", "@open-design/agui-adapter", "build"]);
  await runPnpm(["--filter", "@open-design/plugin-runtime", "build"]);
  await runPnpm(["--filter", "@open-design/diagnostics", "build"]);
  await runPnpm(["--filter", "@open-design/daemon", "build"]);
  try {
    await runPnpm(["--filter", "@open-design/web", "build"], { OD_WEB_OUTPUT_MODE: "server" });
    await runPnpm(["--filter", "@open-design/web", "build:sidecar"]);
    await processWebSourcemaps(config);
  } finally {
    if (previousWebNextEnv == null) {
      await rm(webNextEnvPath, { force: true });
    } else {
      await writeFile(webNextEnvPath, previousWebNextEnv, "utf8");
    }
  }
  await runPnpm(["--filter", "@open-design/desktop", "build"]);
  await runPnpm(["--filter", "@open-design/packaged", "build"]);
}

export async function buildPackedWebui(config: ToolPackConfig): Promise<WebuiBuildResult> {
  const platform = config.platform;
  const arch = config.arch;
  const version = await readPackagedVersion(config);

  // 1) ensure workspace build artifacts (web server-mode + daemon dist + packaged dist).
  const cache = new ToolPackCache(config.roots.cacheRoot);
  await ensureWorkspaceBuildArtifacts(config, cache, async () => {
    await buildWorkspaceArtifactsForWebui(config);
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
