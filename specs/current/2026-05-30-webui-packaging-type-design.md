# 设计：跨平台「WebUI」打包类型

- 日期：2026-05-30
- 状态：已确认设计，待写实现计划
- 范围：新增一种打包类型，把 daemon+web 运行时打成终端启动、跨平台、可配置的包（不含 Electron）

## 1. 背景与目标

当前打包产物只有 Windows / mac 的 GUI 安装包（Electron）。需要新增「WebUI」打包类型，满足：

1. 跨平台支持（Windows、mac、Linux）。
2. 终端启动；GUI 系统双击后弹出终端窗口，终端打印访问地址；若系统有浏览器则直接打开对应 URL。
3. 非 GUI 系统用终端启动，启动后终端打印访问地址。
4. 支持启动参数或配置文件配置：token、端口、远程访问。
5. 同时提供启动命令和停止命令。

## 2. 设计决策（已确认）

| 项 | 决策 |
| --- | --- |
| 运行时 | 捆绑系统 Node + 脚本，复用现有 `apps/packaged/src/headless.ts`，不含 Electron |
| 命令形态 | 单一启动器 + 子命令：`open-design start / stop / status` |
| 配置文件 | 启动器同级目录 `webui.config.json`（JSON）；优先级：命令行参数 > 配置文件 > 环境变量 > 默认值 |
| 远程无 token | 自动生成强 token 并在终端打印（含在 URL 中） |
| Node 运行时 | 要求系统已装 Node 24；仅 `better-sqlite3` 原生模块按平台预编译 |
| 构建产物 | 每平台一个压缩包，`tools-pack webui build --to <平台>` |

## 3. 复用的现有能力

- `apps/packaged/src/headless.ts`：已能在无 Electron 下启动 daemon+web sidecar、建立 IPC（STATUS/SHUTDOWN）、打印 URL。本特性的启动核心基于它推广。
- `apps/daemon/src/browser-open.ts` 的 `openBrowser()` / `createBrowserOpenInvocation()`：已跨平台（`open` / `xdg-open` / `cmd start`），且对缺失 opener 安全（尽力而为，失败仅告警不崩溃）。
- daemon 现有的 `OD_PORT` / `OD_BIND_HOST` / `OD_API_TOKEN` 处理：`apps/daemon/src/server.ts` 已强制「绑定非环回 host 必须设置 `OD_API_TOKEN`」（环回 host 127.0.0.1 / ::1 / localhost 免 token）。
- `tools/pack/src/linux.ts` 的组装流程（`assembledAppRoot`、`runProductionInstall`、`copyResourceTree`）与 `tools/pack/src/workspace-build.ts` 的 `ensureWorkspaceBuildArtifacts`：作为 webui 构建的组装与产物来源参考。

## 4. 产物结构

构建命令：

```
tools-pack webui build --to <mac|win|linux> [--arch <x64|arm64>] [--app-version <ver>] [--json]
```

每平台一个压缩包（mac/win → `.zip`，linux → `.tar.gz`）：

```
open-design-webui-<版本>-<os>-<arch>.(zip|tar.gz)
  app/                         # 组装好的 node 应用：daemon dist + web .next/standalone + packaged dist
    node_modules/              # 生产依赖，含本平台预编译的 better-sqlite3
  bin/open-design              # 启动器外壳脚本 -> 调 `node app/.../webui-launcher.mjs`
  Open Design WebUI.command    # mac 双击 -> 打开 Terminal 运行 `open-design start`
  Open Design WebUI.bat        # win 双击 -> 打开 cmd 窗口运行 start
  open-design-webui.desktop    # linux 双击（Terminal=true）；附 start.sh 兜底
  webui.config.example.json
  README(.md)
```

原生模块策略：要求系统 Node 24（24.x 内 ABI 137 稳定），因此只有 `better-sqlite3` 的预编译产物按平台/架构区分。构建时通过 `prebuild-install --platform/--arch`（或等价方式）拉取目标平台的预编译二进制放入 `app/node_modules`，受支持平台无需本机编译器。跨架构构建需目标平台预编译包存在。

## 5. 启动器 CLI

新入口（位于 `apps/packaged`，例如 `webui-launcher.ts`，编译产物 `dist/webui-launcher.mjs`）。`bin/open-design` 外壳脚本负责定位系统 node 并转发参数。

```
open-design start [--port N] [--host ADDR] [--token T] [--no-open] [--config PATH] [--json]
open-design stop  [--json]
open-design status [--json]
```

### 配置解析（需求 4）

优先级：命令行参数 > `webui.config.json`（自动发现，启动器同级目录）> `OD_*` 环境变量 > 默认值。

配置键：

```json
{
  "port": 7456,
  "host": "0.0.0.0",
  "token": "s3cr3t",
  "openBrowser": true,
  "namespace": "default",
  "dataDir": null
}
```

- `--config PATH` 可显式指定配置文件路径（覆盖自动发现）。
- 解析后映射为 `OD_PORT` / `OD_BIND_HOST` / `OD_API_TOKEN`（以及可选 `OD_DATA_DIR` 与打包命名空间）再启动运行时。

### Node 检查

外壳脚本（`bin/open-design` 及各双击包装）先校验 `node --version` ≥ 24；缺失或版本过低时给出清晰的安装/升级提示并退出（双击 GUI 会话的 PATH 可能不含 node，这里必须有明确报错）。

### start

1. 解析配置。
2. 若 `host` 为非环回地址且未提供 token → 生成强随机 token，在终端醒目打印。
3. 导出 `OD_PORT` / `OD_BIND_HOST` / `OD_API_TOKEN`（及可选项）。
4. 启动 daemon+web 运行时（复用 headless 启动路径 / `startPackagedSidecars`）。
5. 写 `webui-root.json`（pid、url、startedAt）到命名空间 runtime 目录。
6. 打印访问 URL（设置了 token 时附加 `?token=…`）。
7. 按下文 GUI 规则尝试打开浏览器。
8. 建立 IPC server（复用现有 STATUS/SHUTDOWN handler），监听 SIGINT/SIGTERM 优雅关停。

### stop

读取 `webui-root.json`，通过 IPC 发送 `SHUTDOWN`（现有机制）；IPC 不可达时回退到向 pid 发信号；随后清理 identity 文件。

### status

通过 IPC 发送 `STATUS`，打印运行状态与 URL；`--json` 输出机器可读结果。

## 6. GUI 与非 GUI 行为（需求 2、3）

- 双击包装（`.command` / `.bat` / `.desktop`）打开一个**终端窗口**并运行 `open-design start`，因此 GUI 用户能看到终端输出和 URL。
- `openBrowser` 默认按 `auto` 处理：仅在检测到显示设备时打开浏览器。判定 `hasDisplay()`：
  - Windows：视为有显示（除非明确是服务会话）。
  - mac：有显示，除非检测到 `SSH_CONNECTION`（远程会话不开浏览器）。
  - Linux：仅当存在 `DISPLAY` 或 `WAYLAND_DISPLAY`。
- 无 GUI 服务器：仅打印 URL 并继续运行（满足需求 3）。
- `--no-open` 或 `openBrowser: false` 强制关闭自动开浏览器。
- 打开浏览器复用 `openBrowser()`，本身尽力而为，失败仅告警。

## 7. 边界与一致性

- `webui-root.json` 为 packaged 本地 identity 文件，不是 web/daemon API DTO，**无需改动 `packages/contracts`**。
- 本特性属于打包/工具链能力（`tools/pack` 构建命令 + packaged 启动器），不是产品业务能力，因此 AGENTS.md「UI + od CLI 双轨」规则不适用——启动器本身即 CLI 面，没有对应的 web UI 面。**会在 PR 说明里点明这一点，避免 review 误判为缺失 UI 面。**
- 进程身份/命名空间/路径沿用现有 sidecar 约定，不引入第二套进程身份模型；不手搓 `--od-stamp-*`，用 `createProcessStampArgs`。
- pack 资源文件放在 `tools/pack/resources/` 下。

## 8. 测试策略

- `apps/packaged` 单测：
  - 配置优先级（命令行 > 配置文件 > 环境变量 > 默认）。
  - 远程访问无 token 时自动生成 token 的逻辑。
  - `hasDisplay()` 在各平台/各环境变量下的判定。
  - argv 解析与 `--config` / `--no-open` 等开关。
- `tools/pack` 单测：
  - webui 压缩包文件清单（app/、bin/open-design、各双击包装、配置示例、README 均存在）。
  - 按 `--to` 选对 `better-sqlite3` 预编译产物。
- 冒烟：解压产物 → `open-design start` → 轮询 URL 返回 200 → `open-design status` → `open-design stop`（按平台可选门控）。

## 9. 风险与缓解

- **Linux 双击差异**：不同桌面环境对 `.desktop` / 可执行脚本双击行为不一致 → 终端启动为主路径，双击为尽力而为，README 说明。
- **跨架构 better-sqlite3 预编译缺失**：构建目标架构时若无对应预编译包则失败 → 构建前校验并给出明确报错，文档列出受支持的 os/arch 组合。
- **GUI 会话 PATH 缺少 node**：双击启动可能找不到 node → 外壳脚本显式检测并报错，提示安装 Node 24。

## 10. 不在本次范围（YAGNI）

- 不引入自包含单可执行文件（SEA/pkg）方案。
- 不复用 Electron 无窗口模式。
- 不接入产品自动更新（updater）流程。
- 不做 Linux 之外的系统服务/守护进程注册（systemd/launchd/服务）——仅前台终端进程 + start/stop。
