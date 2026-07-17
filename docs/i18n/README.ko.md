<h1 align="center">Open Design WebUI</h1>

<p align="center"><b>브라우저 기반의, Electron 없는 <a href="https://github.com/nexu-io/open-design">Open Design</a> 배포판.</b><br/>터미널에서 실행하고 브라우저에서 사용하세요 —— 데스크톱 앱 설치가 필요 없습니다.</p>

<p align="center">
  <a href="https://github.com/SugarFatFree/open-design-webui/releases/latest">다운로드</a> ·
  <a href="#빠른-시작">빠른 시작</a> ·
  <a href="#소스에서-빌드">소스에서 빌드</a> ·
  <a href="https://github.com/nexu-io/open-design">업스트림 프로젝트</a>
</p>

<p align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja-JP.md">日本語</a> ·
  <b>한국어</b>
</p>

---

## 이게 뭔가요?

**Open Design WebUI** 는 [Open Design](https://github.com/nexu-io/open-design) 의 포크로, **WebUI 형태만** 제공합니다. 업스트림 프로젝트는 Electron 데스크톱 앱과 설치 프로그램도 빌드하지만, 이 포크는 그것들을 모두 제거하고 깔끔한 배포판 하나만 남깁니다:

- 터미널에서 실행하는 로컬 **daemon** + **웹 서버**.
- 일반 **브라우저**에서 `http://127.0.0.1:7456` 로 제품 전체를 사용.
- **Electron 없음, 설치 프로그램 없음, 자동 업데이트 없음** —— 아카이브를 풀고 스크립트 하나만 실행하면 됩니다.

서버, 헤드리스 머신, 원격/SSH 워크플로, 컨테이너, 그리고 데스크톱 앱을 설치하기보다 브라우저 탭을 열고 싶은 모든 사람에게 편리합니다.

## 다운로드

[최신 릴리스](https://github.com/SugarFatFree/open-design-webui/releases/latest)에서 플랫폼에 맞는 아카이브를 받으세요:

| 플랫폼 | 파일 |
| --- | --- |
| Linux x64 | `…-linux-x64.tar.gz` |
| macOS(Apple 실리콘) | `…-mac-arm64.zip` |
| macOS(Intel) | `…-mac-x64.zip` |
| Windows x64 | `…-win-x64.zip` |

> Actions의 *Artifacts* 페이지가 아니라 **Releases** 페이지에서 원본 `.tar.gz` / `.zip` 을 받으세요 —— GitHub는 워크플로 아티팩트를 항상 `.zip` 으로 한 겹 더 감쌉니다.

## 빠른 시작

**요구 사항:** `PATH` 에 [Node.js 24](https://nodejs.org)(`node --version` → `v24.x`). 아카이브에는 나머지 모든 것이 포함되어 있으며, 자체 node를 담지 않고 시스템 Node를 사용합니다.

**Linux / macOS**

```bash
tar -xzf open-design-*-linux-x64.tar.gz     # macOS 에서는 unzip
cd open-design-*/
chmod +x start.sh                            # macOS zip 은 실행 비트가 사라질 수 있습니다
./start.sh
```

**Windows**

```bat
:: 아카이브를 풀고, 풀린 폴더에서:
start.bat
```

그런 다음 브라우저에서 **http://127.0.0.1:7456** 을 엽니다. 웹 UI는 `7456` 포트에서, daemon은 `7457` 포트에서 실행되며 `/api` 로 리버스 프록시되므로 브라우저는 이 주소 하나만 있으면 됩니다.

중지: `./start.sh stop`(Linux/macOS) 또는 `start.bat stop`(Windows).

## 버전 규칙

릴리스는 **`open-design-v<업스트림>-webui-v<포크>`** 형식을 따릅니다. 예: `open-design-v0.15.1-webui-v0.2`:

- `open-design-v0.15.1` —— 이 빌드가 기반한 업스트림 [Open Design](https://github.com/nexu-io/open-design) 버전.
- `webui-v0.2` —— 이 포크 자체의 반복 번호.

## 소스에서 빌드

```bash
corepack enable                 # 고정된 pnpm 선택
pnpm install
# 대상 플랫폼/아키텍처용 WebUI 패키지 빌드:
pnpm tools-pack webui build --platform linux --arch x64
# → open-design-webui-<version>-linux-x64.tar.gz 생성
```

지원하는 `--platform`: `mac` · `win` · `linux`. 지원하는 `--arch`: `x64` · `arm64`.

로컬 개발(daemon + web 핫 리로드)에는 업스트림 라이프사이클 도구를 사용하세요:

```bash
pnpm tools-dev run web --daemon-port 17456 --web-port 17573
```

## 크레딧 및 라이선스

이 프로젝트는 nexu-io의 **[Open Design](https://github.com/nexu-io/open-design)** 의 다운스트림 패키징 포크입니다. 모든 제품 기능, 디자인 시스템, 스킬, 템플릿은 업스트림에서 왔으며, 이 포크는 패키징 및 배포 방식만 바꿉니다. 업스트림 프로젝트에 스타를 눌러 응원해 주세요.

업스트림과 동일한 **Apache-2.0** 라이선스입니다. [`LICENSE`](../../LICENSE) 를 참고하세요.
