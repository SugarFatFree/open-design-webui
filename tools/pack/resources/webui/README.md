# Open Design WebUI

跨平台、终端启动的 Open Design Web 运行时（无 Electron）。

## 前置条件
- 已安装 Node.js 24+（`node --version`）。

## 启动 / 停止
- mac/Linux：`./open-design.sh start`，停止 `./open-design.sh stop`
- Windows：`open-design.cmd start`，停止 `open-design.cmd stop`
- 双击：mac `Open Design WebUI.command`、Windows `Open Design WebUI.bat`、Linux `open-design-webui.desktop`

启动后终端打印访问地址；检测到图形界面时自动打开浏览器。无图形界面（服务器）仅打印地址。

## 配置（优先级：命令行 > webui.config.json > 环境变量 > 默认）
- `--port <N>`（默认 7456）：浏览器访问端口
- `--host <ADDR>`（默认 127.0.0.1；填 `0.0.0.0` 开启远程访问）
- `--token <T>`：保护 daemon `/api`（程序化客户端用 `Authorization: Bearer <T>`）
- `--no-open`：不自动打开浏览器
- `--config <PATH>`：指定配置文件

把上述键写入与本脚本同级的 `webui.config.json` 即可持久化。

## 安全提示
开启远程访问（`host=0.0.0.0`）时，token 仅保护直连 daemon API 的程序化客户端；**Web UI 自身不做应用层鉴权**。如需保护远程 Web UI，请在前面架设反向代理（nginx/caddy basic-auth）或使用 VPN / 网络隔离。
