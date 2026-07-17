<h1 align="center">Open Design WebUI</h1>

<p align="center"><b>基於瀏覽器、無 Electron 的 <a href="https://github.com/nexu-io/open-design">Open Design</a> 發行版。</b><br/>從終端機啟動,在瀏覽器裡使用 —— 無需安裝桌面應用程式。</p>

<p align="center">
  <a href="https://github.com/SugarFatFree/open-design-webui/releases/latest">下載</a> ·
  <a href="#快速開始">快速開始</a> ·
  <a href="#從原始碼建置">從原始碼建置</a> ·
  <a href="https://github.com/nexu-io/open-design">上游專案</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <b>繁體中文</b> ·
  <a href="README.ja-JP.md">日本語</a> ·
  <a href="README.ko.md">한국어</a>
</p>

---

## 這是什麼?

**Open Design WebUI** 是 [Open Design](https://github.com/nexu-io/open-design) 的一個分支,**只保留 WebUI 這一種形態**。上游專案還會建置 Electron 桌面應用程式與安裝檔;本分支把這些全部移除,只保留一份乾淨的發行版:

- 一個本機 **daemon** + **web 服務**,從終端機啟動。
- 在一般**瀏覽器**裡透過 `http://127.0.0.1:7456` 使用整個產品。
- **無 Electron、無安裝檔、無自動更新** —— 解壓一個壓縮檔、執行一個指令稿即可。

它適合伺服器、無頭機器、遠端/SSH 情境、容器,以及任何寧願開一個瀏覽器分頁、也不想安裝桌面應用程式的人。

## 下載

從[最新發布](https://github.com/SugarFatFree/open-design-webui/releases/latest)取得對應平台的壓縮檔:

| 平台 | 檔案 |
| --- | --- |
| Linux x64 | `…-linux-x64.tar.gz` |
| macOS(Apple 晶片) | `…-mac-arm64.zip` |
| macOS(Intel) | `…-mac-x64.zip` |
| Windows x64 | `…-win-x64.zip` |

> 請從 **Releases** 頁面下載原始的 `.tar.gz` / `.zip`,不要從 Actions 的 *Artifacts* 頁面下載 —— GitHub 總會給工作流程產物再套一層 `.zip`。

## 快速開始

**前置需求:** `PATH` 中有 [Node.js 24](https://nodejs.org)(`node --version` → `v24.x`)。壓縮檔已內建其餘一切,它使用你系統裡的 Node,而不自帶 node。

**Linux / macOS**

```bash
tar -xzf open-design-*-linux-x64.tar.gz     # macOS 上用 unzip
cd open-design-*/
chmod +x start.sh                            # macOS 的 zip 可能會遺失可執行位元
./start.sh
```

**Windows**

```bat
:: 解壓壓縮檔,然後在解壓出的資料夾裡:
start.bat
```

然後在瀏覽器裡開啟 **http://127.0.0.1:7456**。Web UI 在 `7456` 連接埠;daemon 在 `7457` 連接埠,並透過 `/api` 反向代理,所以瀏覽器只需這一個位址。

停止:`./start.sh stop`(Linux/macOS)或 `start.bat stop`(Windows)。

## 版本號約定

發布版本遵循 **`open-design-v<上游版本>-webui-v<本分支版本>`**,例如 `open-design-v0.15.1-webui-v0.2`:

- `open-design-v0.15.1` —— 本次建置所基於的上游 [Open Design](https://github.com/nexu-io/open-design) 版本。
- `webui-v0.2` —— 本分支自己的迭代版本號。

## 從原始碼建置

```bash
corepack enable                 # 選用鎖定的 pnpm 版本
pnpm install
# 為目標平台/架構建置 WebUI 套件:
pnpm tools-pack webui build --platform linux --arch x64
# → 產出 open-design-webui-<version>-linux-x64.tar.gz
```

支援的 `--platform`:`mac` · `win` · `linux`。支援的 `--arch`:`x64` · `arm64`。

本機開發(daemon + web 熱更新)請使用上游的生命週期工具:

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## 致謝與授權

本專案是 nexu-io 的 **[Open Design](https://github.com/nexu-io/open-design)** 的下游打包分支。所有產品功能、設計系統、技能與範本都來自上游 —— 本分支只改變打包與散布方式。歡迎給上游專案按星號並支持它。

採用 **Apache-2.0** 授權,與上游一致。見 [`LICENSE`](../../LICENSE)。
