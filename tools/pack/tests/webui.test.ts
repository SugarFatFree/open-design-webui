import { describe, expect, it } from "vitest";

import {
  prebuiltSqliteTarget,
  webuiArchiveName,
  webuiArchiveKind,
} from "../src/webui.js";

describe("webuiArchiveName", () => {
  it("names per platform/arch/version", () => {
    expect(webuiArchiveName({ platform: "mac", arch: "arm64", version: "0.8.1" }))
      .toBe("open-design-webui-0.8.1-mac-arm64.zip");
    expect(webuiArchiveName({ platform: "linux", arch: "x64", version: "0.8.1" }))
      .toBe("open-design-webui-0.8.1-linux-x64.tar.gz");
    expect(webuiArchiveName({ platform: "win", arch: "x64", version: "0.8.1" }))
      .toBe("open-design-webui-0.8.1-win-x64.zip");
  });
});

describe("webuiArchiveKind", () => {
  it("linux -> tar.gz, mac/win -> zip", () => {
    expect(webuiArchiveKind("linux")).toBe("tar.gz");
    expect(webuiArchiveKind("mac")).toBe("zip");
    expect(webuiArchiveKind("win")).toBe("zip");
  });
});

describe("prebuiltSqliteTarget", () => {
  it("maps tools-pack platform/arch to prebuild-install napi target", () => {
    expect(prebuiltSqliteTarget("mac", "arm64")).toEqual({ platform: "darwin", arch: "arm64" });
    expect(prebuiltSqliteTarget("win", "x64")).toEqual({ platform: "win32", arch: "x64" });
    expect(prebuiltSqliteTarget("linux", "x64")).toEqual({ platform: "linux", arch: "x64" });
  });
});
