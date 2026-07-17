<h1 align="center">Open Design WebUI</h1>

<p align="center"><b>ブラウザで動く、Electron なしの <a href="https://github.com/nexu-io/open-design">Open Design</a> ディストリビューション。</b><br/>ターミナルから起動し、ブラウザで利用します —— デスクトップアプリのインストールは不要です。</p>

<p align="center">
  <a href="https://github.com/SugarFatFree/open-design-webui/releases/latest">ダウンロード</a> ·
  <a href="#クイックスタート">クイックスタート</a> ·
  <a href="#ソースからビルド">ソースからビルド</a> ·
  <a href="https://github.com/nexu-io/open-design">アップストリーム</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <b>日本語</b> ·
  <a href="README.ko.md">한국어</a>
</p>

---

## これは何?

**Open Design WebUI** は [Open Design](https://github.com/nexu-io/open-design) のフォークで、**WebUI という形態だけ**を提供します。アップストリームは Electron デスクトップアプリやインストーラーもビルドしますが、このフォークはそれらをすべて取り除き、クリーンなディストリビューションを 1 つだけ残します:

- ターミナルから起動するローカルの **daemon** + **web サーバー**。
- 通常の**ブラウザ**で `http://127.0.0.1:7456` から製品全体を利用。
- **Electron なし、インストーラーなし、自動更新なし** —— アーカイブを展開してスクリプトを 1 つ実行するだけ。

サーバー、ヘッドレスマシン、リモート/SSH のワークフロー、コンテナ、そしてデスクトップアプリをインストールするよりブラウザのタブを開きたい人に便利です。

## ダウンロード

[最新リリース](https://github.com/SugarFatFree/open-design-webui/releases/latest)からお使いのプラットフォームのアーカイブを取得してください:

| プラットフォーム | ファイル |
| --- | --- |
| Linux x64 | `…-linux-x64.tar.gz` |
| macOS(Apple シリコン) | `…-mac-arm64.zip` |
| macOS(Intel) | `…-mac-x64.zip` |
| Windows x64 | `…-win-x64.zip` |

> Actions の *Artifacts* ページではなく、**Releases** ページから生の `.tar.gz` / `.zip` をダウンロードしてください —— GitHub はワークフローの成果物を必ずもう一段 `.zip` で包みます。

## クイックスタート

**要件:** `PATH` に [Node.js 24](https://nodejs.org)(`node --version` → `v24.x`)。アーカイブには他のすべてが同梱されており、独自の node を持たずにシステムの Node を使います。

**Linux / macOS**

```bash
tar -xzf open-design-*-linux-x64.tar.gz     # macOS では unzip
cd <展開したフォルダー>
chmod +x open-design.sh                        # macOS の zip では実行ビットが落ちることがあります
./open-design.sh
```

macOS ユーザーは **`Open Design WebUI.command`** をダブルクリックするだけでも起動できます。

**Windows**

アーカイブを展開し、**`Open Design WebUI.bat`** をダブルクリック —— または展開したフォルダーのターミナルで `open-design.cmd` を実行します。

その後ブラウザで **http://127.0.0.1:7456** を開きます。Web UI はポート `7456`、daemon はポート `7457` で動作し `/api` にリバースプロキシされるため、ブラウザはこの 1 つのアドレスだけで済みます。

停止は `./open-design.sh stop`(Linux/macOS)または `open-design.cmd stop`(Windows)。

## バージョン規則

リリースは **`open-design-v<アップストリーム>-webui-v<フォーク>`** の形式に従います。例: `open-design-v0.15.1-webui-v0.2`:

- `open-design-v0.15.1` —— このビルドの基になったアップストリーム [Open Design](https://github.com/nexu-io/open-design) のバージョン。
- `webui-v0.2` —— このフォーク自身のイテレーション番号。

## ソースからビルド

```bash
corepack enable                 # 固定された pnpm を選択
pnpm install
# ターゲットのプラットフォーム/アーキテクチャ向けに WebUI パッケージをビルド:
pnpm tools-pack webui build --platform linux --arch x64
# → open-design-webui-<version>-linux-x64.tar.gz を生成
```

対応する `--platform`: `mac` · `win` · `linux`。対応する `--arch`: `x64` · `arm64`。

ローカル開発(daemon + web のホットリロード)にはアップストリームのライフサイクルツールを使います:

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## クレジットとライセンス

本プロジェクトは nexu-io による **[Open Design](https://github.com/nexu-io/open-design)** の下流パッケージングフォークです。すべての製品機能、デザインシステム、スキル、テンプレートはアップストリーム由来であり、このフォークはパッケージングと配布方法だけを変えています。ぜひアップストリームにスターを付けて応援してください。

アップストリームと同じ **Apache-2.0** ライセンスです。[`LICENSE`](../../LICENSE) を参照してください。
