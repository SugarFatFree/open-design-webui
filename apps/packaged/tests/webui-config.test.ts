import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  defaultWebuiConfigFileContents,
  ensureWebuiConfigScaffold,
  generateApiToken,
  hasDisplay,
  isLoopbackHost,
  loadConfigFile,
  parseWebuiArgs,
  resolveWebuiConfig,
} from "../src/webui-config.js";

describe("parseWebuiArgs", () => {
  it("parses command + flags", () => {
    const parsed = parseWebuiArgs([
      "start",
      "--port",
      "8080",
      "--host",
      "0.0.0.0",
      "--token",
      "abc",
      "--no-open",
      "--json",
      "--config",
      "/tmp/c.json",
    ]);
    expect(parsed.command).toBe("start");
    expect(parsed.flags).toEqual({
      port: 8080,
      host: "0.0.0.0",
      token: "abc",
      openBrowser: false,
      json: true,
      config: "/tmp/c.json",
    });
  });

  it("parses --daemon-port as an integer", () => {
    const parsed = parseWebuiArgs(["start", "--daemon-port", "42573"]);
    expect(parsed.flags.daemonPort).toBe(42573);
  });

  it("rejects a non-integer --daemon-port", () => {
    expect(() => parseWebuiArgs(["--daemon-port", "abc"])).toThrow(/--daemon-port must be an integer/);
  });

  it("defaults command to start and leaves unset flags undefined", () => {
    const parsed = parseWebuiArgs([]);
    expect(parsed.command).toBe("start");
    expect(parsed.flags.port).toBeUndefined();
    expect(parsed.flags.host).toBeUndefined();
  });

  it("rejects an unknown command", () => {
    expect(() => parseWebuiArgs(["frobnicate"])).toThrow(/unknown command/i);
  });
});

describe("resolveWebuiConfig precedence", () => {
  it("flag > config file > env > default", () => {
    const resolved = resolveWebuiConfig({
      flags: { port: 8080 },
      configFile: { port: 9090, host: "0.0.0.0", token: "cfgtok" },
      env: { OD_WEB_PORT: "5000", OD_BIND_HOST: "127.0.0.1", OD_API_TOKEN: "envtok" },
    });
    expect(resolved.port).toBe(8080);
    expect(resolved.host).toBe("0.0.0.0");
    expect(resolved.token).toBe("cfgtok");
  });

  it("falls back to env then default", () => {
    const resolved = resolveWebuiConfig({
      flags: {},
      configFile: null,
      env: { OD_WEB_PORT: "5000" },
    });
    expect(resolved.port).toBe(5000);
    expect(resolved.host).toBe("127.0.0.1");
    expect(resolved.port).toBeTypeOf("number");
  });

  it("uses default port 7456 and host 127.0.0.1 when nothing set", () => {
    const resolved = resolveWebuiConfig({ flags: {}, configFile: null, env: {} });
    expect(resolved.port).toBe(7456);
    expect(resolved.host).toBe("127.0.0.1");
    expect(resolved.openBrowser).toBe(true);
  });

  it("defaults daemonPort to null (dynamic loopback) when unset", () => {
    const resolved = resolveWebuiConfig({ flags: {}, configFile: null, env: {} });
    expect(resolved.daemonPort).toBeNull();
  });

  it("resolves daemonPort with flag > config > env precedence", () => {
    expect(
      resolveWebuiConfig({ flags: { daemonPort: 11111 }, configFile: { daemonPort: 22222 }, env: { OD_PORT: "33333" } })
        .daemonPort,
    ).toBe(11111);
    expect(
      resolveWebuiConfig({ flags: {}, configFile: { daemonPort: 22222 }, env: { OD_PORT: "33333" } }).daemonPort,
    ).toBe(22222);
    expect(resolveWebuiConfig({ flags: {}, configFile: null, env: { OD_PORT: "33333" } }).daemonPort).toBe(33333);
  });
});

describe("config file scaffolding", () => {
  it("defaultWebuiConfigFileContents is valid JSON exposing both ports", () => {
    const parsed = JSON.parse(defaultWebuiConfigFileContents()) as Record<string, unknown>;
    expect(parsed.port).toBe(7456);
    // daemonPort 0 documents the dynamic-loopback default in the scaffold.
    expect(parsed.daemonPort).toBe(0);
    expect(parsed.host).toBe("127.0.0.1");
  });

  it("ensureWebuiConfigScaffold copies the example when present, else writes defaults", () => {
    const dir = mkdtempSync(join(tmpdir(), "od-cfg-scaffold-"));
    const configPath = join(dir, "webui.config.json");
    const examplePath = join(dir, "webui.config.example.json");

    // No example, no config → writes defaults and reports created=true.
    const first = ensureWebuiConfigScaffold({ configPath, examplePath });
    expect(first.created).toBe(true);
    expect(JSON.parse(loadConfigFileRaw(configPath)).port).toBe(7456);

    // Config already exists → no-op, created=false.
    const second = ensureWebuiConfigScaffold({ configPath, examplePath });
    expect(second.created).toBe(false);

    rmSync(dir, { force: true, recursive: true });
  });

  it("ensureWebuiConfigScaffold copies the example file verbatim when it exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "od-cfg-copy-"));
    const configPath = join(dir, "webui.config.json");
    const examplePath = join(dir, "webui.config.example.json");
    writeFileSync(examplePath, JSON.stringify({ port: 9999, daemonPort: 8888 }), "utf8");

    const result = ensureWebuiConfigScaffold({ configPath, examplePath });
    expect(result.created).toBe(true);
    const written = JSON.parse(loadConfigFileRaw(configPath));
    expect(written.port).toBe(9999);
    expect(written.daemonPort).toBe(8888);

    rmSync(dir, { force: true, recursive: true });
  });
});

function loadConfigFileRaw(path: string): string {
  return readFileSync(path, "utf8");
}

describe("isLoopbackHost", () => {
  it("treats loopback hosts as local", () => {
    expect(isLoopbackHost("127.0.0.1")).toBe(true);
    expect(isLoopbackHost("localhost")).toBe(true);
    expect(isLoopbackHost("::1")).toBe(true);
  });
  it("treats 0.0.0.0 and LAN IPs as remote", () => {
    expect(isLoopbackHost("0.0.0.0")).toBe(false);
    expect(isLoopbackHost("192.168.1.20")).toBe(false);
  });
  it("treats malformed 127.x hosts as remote (matches daemon net.isIP guard)", () => {
    // Without the IPv4 guard these would be misclassified as loopback, so the
    // launcher would skip token generation while the daemon demands a token.
    expect(isLoopbackHost("127.")).toBe(false);
    expect(isLoopbackHost("127.garbage")).toBe(false);
  });
});

describe("generateApiToken", () => {
  it("produces a prefixed base64url token", () => {
    const token = generateApiToken();
    expect(token).toMatch(/^odtoken_[A-Za-z0-9_-]{20,}$/);
    expect(generateApiToken()).not.toBe(token);
  });
});

describe("loadConfigFile", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "webui-config-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses a valid JSON config file", () => {
    const path = join(dir, "ok.json");
    writeFileSync(path, JSON.stringify({ port: 9090, host: "0.0.0.0" }), "utf8");
    expect(loadConfigFile(path)).toEqual({ port: 9090, host: "0.0.0.0" });
  });

  it("returns null when the file does not exist (ENOENT)", () => {
    expect(loadConfigFile(join(dir, "missing.json"))).toBeNull();
  });

  it("throws on invalid JSON", () => {
    const path = join(dir, "bad.json");
    writeFileSync(path, "{ not valid json", "utf8");
    expect(() => loadConfigFile(path)).toThrow(/failed to read config file/i);
  });
});

describe("hasDisplay", () => {
  it("win32 always has display", () => {
    expect(hasDisplay("win32", {})).toBe(true);
  });
  it("darwin has display unless SSH session", () => {
    expect(hasDisplay("darwin", {})).toBe(true);
    expect(hasDisplay("darwin", { SSH_CONNECTION: "x" })).toBe(false);
  });
  it("linux needs DISPLAY or WAYLAND_DISPLAY", () => {
    expect(hasDisplay("linux", {})).toBe(false);
    expect(hasDisplay("linux", { DISPLAY: ":0" })).toBe(true);
    expect(hasDisplay("linux", { WAYLAND_DISPLAY: "wayland-0" })).toBe(true);
  });
});
