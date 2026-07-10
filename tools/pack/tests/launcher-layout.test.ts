import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import type { ToolPackConfig, ToolPackPlatform } from "../src/config.js";
import {
  buildInitialLauncherRuntimeDescriptor,
  payloadArchiveExtension,
  resolveToolPackLauncherChannel,
  resolveToolPackLauncherLayout,
  resolveToolPackLauncherPayloadLayout,
} from "../src/launcher-layout.js";

const TEST_WORKSPACE_ROOT = resolve("/work");

function makeConfig(root: string, platform: ToolPackPlatform, namespace: string, appVersion?: string): ToolPackConfig {
  return {
    ...(appVersion == null ? {} : { appVersion }),
    arch: "x64",
    containerized: false,
    electronBuilderCliPath: "/x/electron-builder/cli.js",
    electronDistPath: "/x/electron/dist",
    electronVersion: "41.3.0",
    macCompression: "normal",
    namespace,
    platform,
    portable: false,
    removeData: false,
    removeLogs: false,
    removeProductUserData: false,
    removeSidecars: false,
    requireVelaCli: false,
    roots: {
      cacheRoot: join(root, ".tmp", "tools-pack", "cache"),
      output: {
        appBuilderRoot: join(root, ".tmp", "tools-pack", "out", platform, "namespaces", namespace, "builder"),
        namespaceRoot: join(root, ".tmp", "tools-pack", "out", platform, "namespaces", namespace),
        platformRoot: join(root, ".tmp", "tools-pack", "out", platform),
        root: join(root, ".tmp", "tools-pack", "out"),
      },
      runtime: {
        namespaceBaseRoot: join(root, ".tmp", "tools-pack", "runtime", platform, "namespaces"),
        namespaceRoot: join(root, ".tmp", "tools-pack", "runtime", platform, "namespaces", namespace),
      },
      toolPackRoot: join(root, ".tmp", "tools-pack"),
    },
    signed: false,
    silent: true,
    to: platform === "win" ? "nsis" : "app",
    webOutputMode: "standalone",
    workspaceRoot: root,
  };
}

describe("tools-pack launcher layout", () => {
  it("derives the update channel from app version before namespace", () => {
    expect(resolveToolPackLauncherChannel(makeConfig(TEST_WORKSPACE_ROOT, "mac", "release-beta", "0.8.1-preview.1"))).toBe("preview");
    expect(resolveToolPackLauncherChannel(makeConfig(TEST_WORKSPACE_ROOT, "win", "release-beta-win", "0.8.1-beta.2"))).toBe("beta");
    expect(resolveToolPackLauncherChannel(makeConfig(TEST_WORKSPACE_ROOT, "mac", "default", "0.8.1"))).toBe("stable");
    expect(resolveToolPackLauncherChannel(makeConfig(TEST_WORKSPACE_ROOT, "mac", "release-prerelease", undefined))).toBe("prerelease");
  });

  it("uses the channel root above namespaces for launcher state", () => {
    const config = makeConfig(TEST_WORKSPACE_ROOT, "mac", "release-beta", "0.8.1-beta.2");
    const layout = resolveToolPackLauncherLayout(config);
    const channelRoot = dirname(config.roots.runtime.namespaceBaseRoot);

    expect(layout.root).toBe(channelRoot);
    expect(layout.paths.namespaceRoot).toBe(
      join(channelRoot, "launcher", "channels", "beta", "namespaces", "release-beta"),
    );
    expect(layout.paths.runtimePath).toBe(join(layout.paths.namespaceRoot, "runtime.json"));
    expect(layout.paths.versionsRoot).toBe(join(layout.paths.namespaceRoot, "versions"));
  });

  it("resolves platform payload archive and extraction paths without changing installed app paths", () => {
    const mac = makeConfig(TEST_WORKSPACE_ROOT, "mac", "release-beta", "0.8.1-beta.2");
    const win = makeConfig(TEST_WORKSPACE_ROOT, "win", "release-beta-win", "0.8.1-beta.2");
    const macPayload = resolveToolPackLauncherPayloadLayout(mac, "0.8.1-beta.2");
    const winPayload = resolveToolPackLauncherPayloadLayout(win, "0.8.1-beta.2");

    expect(macPayload.archivePath).toBe(join(mac.roots.output.namespaceRoot, "payload", "Open Design-release-beta-payload.zip"));
    expect(winPayload.archivePath).toBe(join(win.roots.output.namespaceRoot, "payload", "Open Design-release-beta-win-payload.7z"));
    expect(macPayload.payloadRoot).toBe(join(macPayload.versionRoot, "payload"));
    expect(winPayload.payloadRoot).toBe(join(winPayload.versionRoot, "payload"));
    expect(macPayload.archiveRootName).toBe("payload-0.8.1-beta.2");
  });

  it("uses zip payload archives for mac and 7z payload archives for Windows", () => {
    expect(payloadArchiveExtension("mac")).toBe("zip");
    expect(payloadArchiveExtension("win")).toBe("7z");
    expect(payloadArchiveExtension("linux")).toBe("zip");
  });

  it("builds the initial runtime descriptor for the first launcher-capable version", () => {
    const config = makeConfig(TEST_WORKSPACE_ROOT, "win", "release-beta-win", "0.8.1-beta.2");

    expect(buildInitialLauncherRuntimeDescriptor(config, "0.8.1-beta.2")).toEqual({
      active: { generation: 0, version: "0.8.1-beta.2" },
      channel: "beta",
      lastSuccessful: { generation: 0, version: "0.8.1-beta.2" },
      namespace: "release-beta-win",
      schemaVersion: 1,
    });
  });

  it("rejects unsafe payload version segments through launcher-proto", () => {
    const config = makeConfig(TEST_WORKSPACE_ROOT, "mac", "release-beta", "0.8.1-beta.2");
    expect(() => resolveToolPackLauncherPayloadLayout(config, "../0.8.1-beta.2")).toThrow(/path separators/);
  });
});
