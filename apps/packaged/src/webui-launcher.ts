import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  APP_KEYS,
  OPEN_DESIGN_SIDECAR_CONTRACT,
  SIDECAR_DEFAULTS,
  SIDECAR_MESSAGES,
  SIDECAR_MODES,
  SIDECAR_SOURCES,
  normalizeDesktopSidecarMessage,
  type SidecarStamp,
} from "@open-design/sidecar-proto";
import {
  bootstrapSidecarRuntime,
  createJsonIpcServer,
  requestJsonIpc,
  resolveAppIpcPath,
} from "@open-design/sidecar";
import { openBrowser } from "@open-design/daemon/browser-open";

import { PACKAGED_NAMESPACE_ENV, type PackagedConfig } from "./config.js";
import { writePackagedDesktopIdentity, writePackagedWebIdentity } from "./identity.js";
import { resolvePackagedNamespacePaths } from "./paths.js";
import { startPackagedSidecars } from "./sidecars.js";
import {
  generateApiToken,
  hasDisplay,
  isLoopbackHost,
  loadConfigFile,
  parseWebuiArgs,
  resolveWebuiConfig,
  type ResolvedWebuiConfig,
} from "./webui-config.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function resolveNamespaceBaseRoot(): string {
  const odDataDir = process.env.OD_DATA_DIR;
  if (odDataDir != null && odDataDir.length > 0) {
    return join(resolve(odDataDir.replace(/^~/, homedir())), "namespaces");
  }
  const xdgDataHome = process.env.XDG_DATA_HOME;
  const dataBase =
    xdgDataHome != null && xdgDataHome.length > 0 ? xdgDataHome : join(homedir(), ".local", "share");
  return join(dataBase, "open-design", "namespaces");
}

function resolveLauncherConfig(namespace: string): PackagedConfig {
  const resourceRoot =
    process.env.OD_RESOURCE_ROOT ?? join(__dirname, "..", "..", "..", "open-design");
  return {
    amrProfile: null,
    appVersion: null,
    daemonCliEntry: null,
    daemonSidecarEntry: null,
    namespace,
    namespaceBaseRoot: resolveNamespaceBaseRoot(),
    nodeCommand: null,
    resourceRoot,
    telemetryRelayUrl: process.env.OPEN_DESIGN_TELEMETRY_RELAY_URL?.trim() || null,
    posthogKey: process.env.POSTHOG_KEY?.trim() || null,
    posthogHost: process.env.POSTHOG_HOST?.trim() || null,
    webSidecarEntry: null,
    webStandaloneRoot: null,
    // 与现有 Linux headless 一致的、已验证可在打包后运行的 web 运行模式。
    webOutputMode: "server",
  };
}

function createStamp(namespace: string): SidecarStamp {
  return {
    app: APP_KEYS.DESKTOP,
    ipc: resolveAppIpcPath({ app: APP_KEYS.DESKTOP, contract: OPEN_DESIGN_SIDECAR_CONTRACT, namespace }),
    mode: SIDECAR_MODES.RUNTIME,
    namespace,
    source: SIDECAR_SOURCES.PACKAGED,
  };
}

function colorize(text: string): string {
  if (process.stdout.isTTY !== true || process.env.NO_COLOR != null) return text;
  return `\x1b[36m\x1b[4m${text}\x1b[0m`;
}

function discoverConfigFile(explicitPath?: string) {
  if (explicitPath != null) return loadConfigFile(explicitPath);
  const candidates = [
    join(process.cwd(), "webui.config.json"),
    join(__dirname, "..", "..", "..", "..", "webui.config.json"),
  ];
  for (const candidate of candidates) {
    const cfg = loadConfigFile(candidate);
    if (cfg != null) return cfg;
  }
  return null;
}

function browserUrl(config: ResolvedWebuiConfig): string {
  const host = isLoopbackHost(config.host) ? "localhost" : config.host;
  return `http://${host}:${config.port}`;
}

async function commandStart(config: ResolvedWebuiConfig, json: boolean): Promise<void> {
  const namespace = OPEN_DESIGN_SIDECAR_CONTRACT.normalizeNamespace(
    config.namespace ?? process.env[PACKAGED_NAMESPACE_ENV] ?? SIDECAR_DEFAULTS.namespace,
  );
  if (config.dataDir != null) process.env.OD_DATA_DIR = config.dataDir;

  let token = config.token;
  if (!isLoopbackHost(config.host) && (token == null || token.length === 0)) {
    token = generateApiToken();
    process.stdout.write(`\n  未为远程访问设置 token，已自动生成：\n    token: ${token}\n`);
  }

  const packagedConfig = resolveLauncherConfig(namespace);
  const paths = resolvePackagedNamespacePaths(packagedConfig);
  const stamp = createStamp(namespace);
  await mkdir(paths.runtimeRoot, { recursive: true });

  const runtime = bootstrapSidecarRuntime(stamp, process.env, {
    app: APP_KEYS.DESKTOP,
    base: paths.runtimeRoot,
    contract: OPEN_DESIGN_SIDECAR_CONTRACT,
  });

  const identity = await writePackagedDesktopIdentity({
    identityPath: paths.headlessIdentityPath,
    paths,
    stamp,
  });

  const sidecars = await startPackagedSidecars(runtime, paths, {
    appVersion: packagedConfig.appVersion,
    amrProfile: packagedConfig.amrProfile,
    daemonCliEntry: packagedConfig.daemonCliEntry,
    daemonSidecarEntry: packagedConfig.daemonSidecarEntry,
    nodeCommand: packagedConfig.nodeCommand,
    telemetryRelayUrl: packagedConfig.telemetryRelayUrl,
    posthogKey: packagedConfig.posthogKey,
    posthogHost: packagedConfig.posthogHost,
    // webui mode: no Electron, no shell.openPath surface; no desktop auth gate.
    requireDesktopAuth: false,
    webSidecarEntry: packagedConfig.webSidecarEntry,
    webStandaloneRoot: packagedConfig.webStandaloneRoot,
    webOutputMode: packagedConfig.webOutputMode,
    network: {
      webHost: config.host,
      webPort: config.port,
      daemonPort: null,
      bindHost: config.host,
      apiToken: token,
    },
  });

  const webUrl = sidecars.web.url;
  if (!webUrl) {
    await sidecars.close().catch(() => undefined);
    await identity.close().catch(() => undefined);
    throw new Error("web sidecar failed to produce URL — check logs/desktop/latest.log");
  }
  const displayUrl = browserUrl(config);

  const shutdown = async (): Promise<void> => {
    process.stdout.write("\n Shutting down Open Design...\n");
    await ipcServer.close().catch(() => undefined);
    await sidecars.close().catch(() => undefined);
    await identity.close().catch(() => undefined);
    process.exit(0);
  };

  const ipcServer = await createJsonIpcServer({
    socketPath: stamp.ipc,
    handler: async (message: unknown) => {
      const request = normalizeDesktopSidecarMessage(message);
      switch (request.type) {
        case SIDECAR_MESSAGES.STATUS:
          return { pid: process.pid, state: "running", url: displayUrl, updatedAt: new Date().toISOString() };
        case SIDECAR_MESSAGES.SHUTDOWN:
          setImmediate(() => {
            void shutdown().finally(() => process.exit(0));
          });
          return { accepted: true };
      }
    },
  });

  await writePackagedWebIdentity({ paths, pid: process.pid, url: displayUrl });

  if (json) {
    process.stdout.write(`${JSON.stringify({ pid: process.pid, url: displayUrl, token })}\n`);
  } else {
    process.stdout.write(`\n Open Design is running\n\n`);
    process.stdout.write(` ➜ ${colorize(token ? `${displayUrl}/?token=${token}` : displayUrl)}\n\n`);
    process.stdout.write(` Press Ctrl+C to stop\n\n`);
  }

  if (config.openBrowser && hasDisplay(process.platform, process.env)) {
    openBrowser(displayUrl);
  }

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

async function commandStopOrStatus(command: "stop" | "status", json: boolean): Promise<void> {
  const namespace = OPEN_DESIGN_SIDECAR_CONTRACT.normalizeNamespace(
    process.env[PACKAGED_NAMESPACE_ENV] ?? SIDECAR_DEFAULTS.namespace,
  );
  const ipc = resolveAppIpcPath({ app: APP_KEYS.DESKTOP, contract: OPEN_DESIGN_SIDECAR_CONTRACT, namespace });
  const type = command === "stop" ? SIDECAR_MESSAGES.SHUTDOWN : SIDECAR_MESSAGES.STATUS;
  try {
    const reply = await requestJsonIpc(ipc, { type }, { timeoutMs: 2000 });
    if (json) process.stdout.write(`${JSON.stringify(reply)}\n`);
    else if (command === "status") process.stdout.write(` ${JSON.stringify(reply)}\n`);
    else process.stdout.write(` Open Design 已停止\n`);
  } catch {
    if (json) process.stdout.write(`${JSON.stringify({ state: "stopped" })}\n`);
    else process.stdout.write(` 未发现运行中的 Open Design（namespace=${namespace}）\n`);
    if (command === "status") process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const { command, flags } = parseWebuiArgs(process.argv.slice(2));
  if (command === "start") {
    const configFile = discoverConfigFile(flags.config);
    const config = resolveWebuiConfig({ flags, configFile, env: process.env });
    await commandStart(config, flags.json === true);
    return;
  }
  await commandStopOrStatus(command, flags.json === true);
}

void main().catch((error: unknown) => {
  process.stderr.write(`open-design webui failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
