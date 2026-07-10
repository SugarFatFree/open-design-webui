import { cac } from "cac";
import type { CAC } from "cac";

import type { ToolPackCliOptions, ToolPackPlatform } from "./config.js";
import { addWebuiBuildOptions, buildPackedWebui, resolveWebuiPackConfig } from "./webui/build.js";

type CliOptions = ToolPackCliOptions;

function printJson(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

type CacCommand = ReturnType<CAC["command"]>;

function addSharedOptions(command: CacCommand) {
  return command
    .option("--cache-dir <path>", "advanced escape hatch for relocating tools-pack cache")
    .option("--dir <path>", "tools-pack output/runtime root directory")
    .option("--diagnose-attempts <count>", "diagnose-ipc: start/poll/stop attempts")
    .option("--json", "print JSON")
    .option("--namespace <name>", "runtime namespace")
    .option("--expr <expression>", "desktop inspect eval expression")
    .option("--path <path>", "desktop inspect screenshot path")
    .option("--status-poll-count <count>", "inspect: poll desktop/daemon/web STATUS this many times")
    .option("--status-poll-interval-ms <ms>", "inspect: delay between STATUS poll samples")
    .option("--update-action <action>", "desktop update action: status|check|download|install");
}

const cli = cac("tools-pack");

function resolveWebuiPlatform(value: unknown): ToolPackPlatform {
  if (value === "mac" || value === "win" || value === "linux") return value;
  if (value == null || value === "") {
    if (process.platform === "darwin") return "mac";
    if (process.platform === "win32") return "win";
    return "linux";
  }
  throw new Error(`unsupported --platform: ${String(value)} (expected mac|win|linux)`);
}

addWebuiBuildOptions(
  addSharedOptions(
    cli
      .command("webui <action>", "WebUI packaging commands: build")
      .option("--platform <platform>", "Target platform: mac|win|linux (default: host)")
      .option("--arch <arch>", "Target arch: x64|arm64 (default: host arch)"),
  ),
).action(async (action: string, options: CliOptions) => {
  const platform = resolveWebuiPlatform(options.platform);
  const config = resolveWebuiPackConfig(platform, options);
  switch (action) {
    case "build":
      printJson(await buildPackedWebui(config));
      return;
    default:
      throw new Error(`unknown webui action: ${action} (expected build)`);
  }
});

cli.help();
cli.parse();
