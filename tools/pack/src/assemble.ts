import { execFile } from "node:child_process";
import { chmod, cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { createPackageManagerInvocation } from "@open-design/platform";

import type { ToolPackConfig } from "./config.js";
import { copyBundledResourceTrees } from "./resources.js";
import { copyOptionalVelaCliBinary } from "./vela-cli.js";
import { electronBuilderVersionForAppVersion, readRuntimeAppVersion } from "./versions.js";

const execFileAsync = promisify(execFile);

// The env var the containerized Linux build sets to the standalone pnpm binary
// it bootstrapped (the `electronuserland/builder:base` image strips
// npm/npx/corepack). resolveProductionInstallCommand reads it to avoid invoking
// `npm` inside the container.
const PRODUCTION_INSTALL_PNPM_BIN_ENV = "OD_TOOLS_PACK_PNPM_BIN";

export const INTERNAL_PACKAGES = [
  { directory: "packages/contracts", name: "@open-design/contracts" },
  { directory: "packages/registry-protocol", name: "@open-design/registry-protocol" },
  { directory: "packages/sidecar-proto", name: "@open-design/sidecar-proto" },
  { directory: "packages/sidecar", name: "@open-design/sidecar" },
  { directory: "packages/platform", name: "@open-design/platform" },
  { directory: "packages/download", name: "@open-design/download" },
  { directory: "packages/host", name: "@open-design/host" },
  { directory: "packages/agui-adapter", name: "@open-design/agui-adapter" },
  { directory: "packages/plugin-runtime", name: "@open-design/plugin-runtime" },
  { directory: "packages/diagnostics", name: "@open-design/diagnostics" },
  { directory: "apps/daemon", name: "@open-design/daemon" },
  { directory: "apps/web", name: "@open-design/web" },
  { directory: "apps/desktop", name: "@open-design/desktop" },
  { directory: "apps/packaged", name: "@open-design/packaged" },
] as const;

export type PackedTarballInfo = {
  fileName: string;
  packageName: (typeof INTERNAL_PACKAGES)[number]["name"];
};

async function runPnpm(
  config: ToolPackConfig,
  args: string[],
  extraEnv: NodeJS.ProcessEnv = {},
): Promise<void> {
  const invocation = createPackageManagerInvocation(args, process.env);
  await execFileAsync(invocation.command, invocation.args, {
    cwd: config.workspaceRoot,
    env: { ...process.env, ...extraEnv },
  });
}

export type ProductionInstallCommand = { command: string; args: string[] };

// Picks the package manager used to materialize the assembled-app node_modules.
// The default (`npm`) preserves host behavior for developer-machine builds. When
// the build runs inside `electronuserland/builder:base` (which strips npm, npx,
// and corepack), buildDockerArgs sets OD_TOOLS_PACK_PNPM_BIN to the standalone
// pnpm binary it bootstrapped, and this resolver routes the install through that
// binary. `--config.node-linker=hoisted` keeps the resulting layout flat so
// electron-builder packs node_modules the same way it does for npm-installed
// trees.
export function resolveProductionInstallCommand(env: NodeJS.ProcessEnv): ProductionInstallCommand {
  const pnpmBin = env[PRODUCTION_INSTALL_PNPM_BIN_ENV];
  if (pnpmBin != null && pnpmBin.length > 0) {
    return {
      command: pnpmBin,
      args: ["install", "--prod", "--no-lockfile", "--config.node-linker=hoisted"],
    };
  }
  return { command: "npm", args: ["install", "--omit=dev", "--no-package-lock"] };
}

async function runProductionInstall(appRoot: string): Promise<void> {
  const { command, args } = resolveProductionInstallCommand(process.env);
  await execFileAsync(command, args, {
    cwd: appRoot,
    env: process.env,
  });
}

export async function readPackagedVersion(config: ToolPackConfig): Promise<string> {
  return readRuntimeAppVersion(config);
}

// Pack every internal workspace package into a tarball under `tarballsRoot` and
// return the resulting {fileName, packageName} list. Each pack is diffed against
// the prior directory listing so the produced tarball is matched to its package
// even when pnpm emits a versioned filename.
export async function collectWorkspaceTarballs(
  config: ToolPackConfig,
  tarballsRoot: string,
): Promise<PackedTarballInfo[]> {
  await rm(tarballsRoot, { force: true, recursive: true });
  await mkdir(tarballsRoot, { recursive: true });
  const packed: PackedTarballInfo[] = [];

  for (const pkg of INTERNAL_PACKAGES) {
    const before = new Set(await readdir(tarballsRoot));
    await runPnpm(config, ["-C", pkg.directory, "pack", "--pack-destination", tarballsRoot]);
    const after = await readdir(tarballsRoot);
    const novel = after.filter((e) => !before.has(e));
    if (novel.length !== 1 || novel[0] == null) {
      throw new Error(`expected one tarball for ${pkg.name}, got ${novel.length}`);
    }
    packed.push({ fileName: novel[0], packageName: pkg.name });
  }
  return packed;
}

// Copy the bundled resource trees (skills, design-templates, design-systems, …)
// into `<resourceRoot>`. By default it also copies the current `process.execPath`
// into `<resourceRoot>/bin/node` (chmod 755) so packaged Electron builds ship a
// Node binary; the WebUI distribution sets `includeNodeBinary: false` because it
// requires the user's installed system Node.
export async function copyResourceTree(
  config: ToolPackConfig,
  resourceRoot: string,
  options: { includeNodeBinary?: boolean } = {},
): Promise<void> {
  await rm(resourceRoot, { force: true, recursive: true });
  await mkdir(resourceRoot, { recursive: true });
  await copyBundledResourceTrees({
    workspaceRoot: config.workspaceRoot,
    resourceRoot,
  });
  if (options.includeNodeBinary !== false) {
    await mkdir(join(resourceRoot, "bin"), { recursive: true });
    await cp(process.execPath, join(resourceRoot, "bin", "node"));
    await chmod(join(resourceRoot, "bin", "node"), 0o755);
  }
  await copyOptionalVelaCliBinary({
    platform: config.platform,
    requireBundled: config.requireVelaCli,
    resourceRoot,
  });
}

// Writes the assembled node-app's package.json (with `file:` tarball deps) plus
// a `main.cjs` stub that requires @open-design/packaged, then runs the
// production install into `appRoot`. This is the shared core of the Linux
// Electron-app assembly and the WebUI distribution. Electron-only artifacts
// (preload.cjs, open-design-config.json) are written by the Linux caller around
// this primitive, not here.
export async function assembleNodeApp({
  config,
  appRoot,
  tarballsRoot,
  packed,
}: {
  config: ToolPackConfig;
  appRoot: string;
  tarballsRoot: string;
  packed: PackedTarballInfo[];
}): Promise<void> {
  await mkdir(appRoot, { recursive: true });

  const dependencies: Record<string, string> = {};
  for (const tarball of packed) {
    dependencies[tarball.packageName] = `file:${join(tarballsRoot, tarball.fileName)}`;
  }

  const version = await readPackagedVersion(config);
  const packageVersion = electronBuilderVersionForAppVersion(version);
  const packageJson = {
    name: "open-design-packaged",
    version: packageVersion,
    private: true,
    main: "main.cjs",
    dependencies,
    description: "Local-first design product: detects your installed code-agent CLI, runs design skills + design systems, streams artifacts into a sandboxed preview.",
    author: "Open Design Team",
    repository: {
      type: "git",
      url: "https://github.com/nexu-io/open-design.git"
    }
  };
  await writeFile(join(appRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  const mainStub = `"use strict";\nrequire("@open-design/packaged");\n`;
  await writeFile(join(appRoot, "main.cjs"), mainStub, "utf8");

  await runProductionInstall(appRoot);
}
