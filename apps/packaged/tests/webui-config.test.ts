import { describe, expect, it } from "vitest";

import {
  generateApiToken,
  hasDisplay,
  isLoopbackHost,
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
});

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
});

describe("generateApiToken", () => {
  it("produces a prefixed base64url token", () => {
    const token = generateApiToken();
    expect(token).toMatch(/^odtoken_[A-Za-z0-9_-]{20,}$/);
    expect(generateApiToken()).not.toBe(token);
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
