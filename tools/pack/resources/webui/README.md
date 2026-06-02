# Open Design WebUI

跨平台、终端启动的 Open Design Web 运行时（无 Electron）。

## 前置条件
- 已安装 Node.js 24+（`node --version`）。

## 启动 / 停止
- mac/Linux：`./open-design.sh start`，停止 `./open-design.sh stop`
- Windows：`open-design.cmd start`，停止 `open-design.cmd stop`
- 双击：mac `Open Design WebUI.command`、Windows `Open Design WebUI.bat`、Linux `open-design-webui.desktop`

启动后终端打印访问地址；检测到图形界面时自动打开浏览器。无图形界面（服务器）仅打印地址。

## 架构：为什么只有一个端口
本发行物是两进程（web + daemon），但只有 **web 端口** 对你可见——它就是终端打印的访问地址。daemon 作为内部子进程运行，默认绑定一个**随机环回端口（仅本机）**，web 会把 `/api/*` 反代到它，所以你**不需要**单独访问 daemon 端口。启动输出里会说明 web 与 daemon 各自的监听地址。

## 配置（优先级：命令行 > webui.config.json > 环境变量 > 默认）
- `--port <N>`（默认 7456）：浏览器访问端口（web）
- `--daemon-port <N>`（默认随机环回）：固定 daemon 监听端口；仅在需要直连 daemon `/api` 时设置，否则保持随机环回更安全
- `--host <ADDR>`（默认 127.0.0.1；填 `0.0.0.0` 开启远程访问）
- `--token <T>`：保护 daemon `/api`（程序化客户端用 `Authorization: Bearer <T>`）
- `--no-open`：不自动打开浏览器
- `--config <PATH>`：指定配置文件

**首次 `start` 会自动在脚本同级目录创建 `webui.config.json`**（复制 `webui.config.example.json`，没有则写入默认值）；已存在则不覆盖。可直接编辑它持久化配置。配置键：`port`（web 端口）、`daemonPort`（daemon 端口，`0` = 随机环回）、`host`、`token`、`openBrowser`，以及两个可选键 `namespace`（运行时命名空间，隔离多实例）与 `dataDir`（覆盖数据目录，等价 `OD_DATA_DIR`）。

## 安全提示
开启远程访问（`host=0.0.0.0`）时，token 仅保护直连 daemon API 的程序化客户端；**Web UI 自身不做应用层鉴权**。如需保护远程 Web UI，请在前面架设反向代理（nginx/caddy basic-auth）或使用 VPN / 网络隔离。
