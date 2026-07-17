<h1 align="center">Open Design WebUI</h1>

<p align="center"><b>基于浏览器、无 Electron 的 <a href="https://github.com/nexu-io/open-design">Open Design</a> 发行版。</b><br/>从终端启动,在浏览器里使用 —— 无需安装桌面客户端。</p>

<p align="center">
  <a href="https://github.com/SugarFatFree/open-design-webui/releases/latest">下载</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#从源码构建">从源码构建</a> ·
  <a href="https://github.com/nexu-io/open-design">上游项目</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <b>简体中文</b> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja-JP.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

---

## 这是什么?

**Open Design WebUI** 是 [Open Design](https://github.com/nexu-io/open-design) 的一个分支,**只保留 WebUI 这一种形态**。上游项目还会构建 Electron 桌面客户端和安装包;本分支把这些全部去掉,只保留一份干净的发行版:

- 一个本地 **daemon** + **web 服务**,从终端启动。
- 在普通**浏览器**里通过 `http://127.0.0.1:7456` 使用整个产品。
- **无 Electron、无安装包、无自动更新** —— 解压一个压缩包、运行一个脚本即可。

它适合服务器、无头机器、远程/SSH 场景、容器,以及任何更愿意开一个浏览器标签页、而不想安装桌面客户端的人。

## 下载

从[最新发布](https://github.com/SugarFatFree/open-design-webui/releases/latest)获取对应平台的压缩包:

| 平台 | 文件 |
| --- | --- |
| Linux x64 | `…-linux-x64.tar.gz` |
| macOS(Apple 芯片) | `…-mac-arm64.zip` |
| macOS(Intel) | `…-mac-x64.zip` |
| Windows x64 | `…-win-x64.zip` |

> 请从 **Releases** 页面下载原始的 `.tar.gz` / `.zip`,不要从 Actions 的 *Artifacts* 页面下载 —— GitHub 总会给工作流产物再套一层 `.zip`。

## 快速开始

**前置要求:** `PATH` 中有 [Node.js 24](https://nodejs.org)(`node --version` → `v24.x`)。压缩包已内置其余一切,它使用你系统里的 Node,而不自带 node。

**Linux / macOS**

```bash
tar -xzf open-design-*-linux-x64.tar.gz     # macOS 上用 unzip
cd <解压出的文件夹>
chmod +x open-design.sh                        # macOS 的 zip 可能会丢掉可执行位
./open-design.sh
```

macOS 用户也可以直接双击 **`Open Design WebUI.command`**。

**Windows**

解压后双击 **`Open Design WebUI.bat`** —— 或在解压出的文件夹里用终端运行 `open-design.cmd`。

然后在浏览器里打开 **http://127.0.0.1:7456**。Web UI 在 `7456` 端口;daemon 在 `7457` 端口,并通过 `/api` 反向代理,所以浏览器只需这一个地址。

停止:`./open-design.sh stop`(Linux/macOS)或 `open-design.cmd stop`(Windows)。

## 版本号约定

发布版本遵循 **`open-design-v<上游版本>-webui-v<本分支版本>`**,例如 `open-design-v0.15.1-webui-v0.2`:

- `open-design-v0.15.1` —— 本次构建所基于的上游 [Open Design](https://github.com/nexu-io/open-design) 版本。
- `webui-v0.2` —— 本分支自己的迭代版本号。

## 从源码构建

```bash
corepack enable                 # 选用锁定的 pnpm 版本
pnpm install
# 为目标平台/架构构建 WebUI 包:
pnpm tools-pack webui build --platform linux --arch x64
# → 产出 open-design-webui-<version>-linux-x64.tar.gz
```

支持的 `--platform`:`mac` · `win` · `linux`。支持的 `--arch`:`x64` · `arm64`。

本地开发(daemon + web 热更新)请使用上游的生命周期工具:

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## 致谢与许可

本项目是 nexu-io 的 **[Open Design](https://github.com/nexu-io/open-design)** 的下游打包分支。所有产品功能、设计系统、技能和模板都来自上游 —— 本分支只改变打包和分发方式。欢迎给上游项目点 star 并支持它。

采用 **Apache-2.0** 许可,与上游一致。见 [`LICENSE`](../../LICENSE)。
