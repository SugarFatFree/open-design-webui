<h1 align="center">Open Design WebUI</h1>

<p align="center"><b>A browser-based, no-Electron distribution of <a href="https://github.com/nexu-io/open-design">Open Design</a>.</b><br/>Launch it from a terminal, use it in your browser — no desktop app to install.</p>

<p align="center">
  <a href="https://github.com/SugarFatFree/open-design-webui/releases/latest">Download</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#build-from-source">Build from source</a> ·
  <a href="https://github.com/nexu-io/open-design">Upstream project</a>
</p>

<p align="center">
  <b>English</b> ·
  <a href="docs/i18n/README.zh-CN.md">简体中文</a> ·
  <a href="docs/i18n/README.zh-TW.md">繁體中文</a> ·
  <a href="docs/i18n/README.ja-JP.md">日本語</a> ·
  <a href="docs/i18n/README.ko.md">한국어</a>
</p>

---

## What is this?

**Open Design WebUI** is a fork of [Open Design](https://github.com/nexu-io/open-design) that ships **only the WebUI form factor**. The upstream project also builds Electron desktop apps and installers; this fork strips all of that away and keeps a single, clean distribution:

- A local **daemon** + **web server** that you start from a terminal.
- You use the whole product in an ordinary **browser** at `http://127.0.0.1:7456`.
- **No Electron, no installer, no auto-updater** — just extract an archive and run one script.

This is convenient for servers, headless machines, remote/SSH workflows, containers, and anyone who would rather open a browser tab than install a desktop app.

## Download

Grab the archive for your platform from the [latest release](https://github.com/SugarFatFree/open-design-webui/releases/latest):

| Platform | File |
| --- | --- |
| Linux x64 | `…-linux-x64.tar.gz` |
| macOS (Apple Silicon) | `…-mac-arm64.zip` |
| macOS (Intel) | `…-mac-x64.zip` |
| Windows x64 | `…-win-x64.zip` |

> Download from the **Releases** page (raw `.tar.gz` / `.zip`), not from the Actions *Artifacts* page — GitHub always re-wraps workflow artifacts in an extra `.zip`.

## Quick start

**Requirement:** [Node.js 24](https://nodejs.org) on your `PATH` (`node --version` → `v24.x`). The archive bundles everything else; it uses your system Node instead of shipping its own.

**Linux / macOS**

```bash
tar -xzf open-design-*-linux-x64.tar.gz     # or unzip on macOS
cd <extracted-folder>
chmod +x open-design.sh                       # macOS zips may drop the exec bit
./open-design.sh
```

macOS users can also just double-click **`Open Design WebUI.command`**.

**Windows**

Unzip the archive, then double-click **`Open Design WebUI.bat`** — or from a terminal in the extracted folder run `open-design.cmd`.

Then open **http://127.0.0.1:7456** in your browser. The web UI is served on port `7456`; the daemon runs on `7457` and is reverse-proxied under `/api`, so the browser only ever needs the one address.

Stop it with `./open-design.sh stop` (Linux/macOS) or `open-design.cmd stop` (Windows).

## Versioning

Releases follow the scheme **`open-design-v<upstream>-webui-v<fork>`**, e.g. `open-design-v0.15.1-webui-v0.2`:

- `open-design-v0.15.1` — the upstream [Open Design](https://github.com/nexu-io/open-design) version this build is based on.
- `webui-v0.2` — this fork's own iteration number.

## Build from source

```bash
corepack enable                 # selects the pinned pnpm
pnpm install
# Build a WebUI package for a target platform/arch:
pnpm tools-pack webui build --platform linux --arch x64
# → produces open-design-webui-<version>-linux-x64.tar.gz
```

Supported `--platform`: `mac` · `win` · `linux`. Supported `--arch`: `x64` · `arm64`.

For local development (daemon + web with hot reload) use the upstream lifecycle tooling:

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## Credits & license

This project is a downstream packaging fork of **[Open Design](https://github.com/nexu-io/open-design)** by nexu-io. All product features, design systems, skills, and templates come from upstream — this fork only changes how it is packaged and distributed. Please star and support the upstream project.

Licensed under **Apache-2.0**, the same as upstream. See [`LICENSE`](LICENSE).
