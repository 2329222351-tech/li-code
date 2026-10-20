# li-code

> 日常神秘玩意 —— 个人项目代码合集与备份

每个章节（chapter）是完全独立的目录，互不关联。后续新增项目会按序号继续往下排（02、03…）。

## 目录结构

```
li-code/
├── README.md
└── chapters/
    ├── 01-code1/           ← 第一章
    │   ├── MavisReminder.apk        Android 定时提醒 APP（已签名）
    │   ├── kuaishou-signin/         快手自动签到工具（Auto.js + 模拟器）
    │   └── termux-tasker-master/    termux-tasker 上游源码备份
    └── 02-code2/           ← 第二章
        ├── app/ components/ composables/   Nuxt 3 前端
        ├── server/                         Nitro 服务端 API 与词库
        ├── electron/                       Electron 主进程 / preload
        └── release/                        打包产物（Git LFS）
    └── 03-code3/           ← 第三章
        ├── GPS虚拟定位工具_思路设计.md      设计思路文档
        └── GpsRoam/                        Android 工程
            ├── app/src/main/java/com/gpsroam/   Kotlin 源码
            ├── screenshots/                     界面截图
            └── ui-prototype/                    HTML 高保真原型
    └── 04-code2.1/         ← 第四章
        ├── app/ components/ composables/   Nuxt 3 前端
        ├── server/                         Nitro 服务端 API 与题库
        ├── electron/                       Electron 主进程 / preload
        ├── tests/                          Vitest 单元测试
        └── release/                        打包产物（单文件 exe）
    └── 05-code3.1/         ← 第五章
        ├── GpsPoint/                       Android 工程（GpsRoam 衍生版）
        │   ├── app/src/main/java/com/gpspoint/   Kotlin 源码
        │   ├── screenshots/                     界面截图
        │   └── ui-prototype/                    HTML 高保真原型
        └── GpsPoint-v1.1.apk                已构建 APK（5.3MB）
    └── 06-code2.1e/        ← 第六章（当前）
        ├── 学生手册背诵-1.0.0.exe            单文件绿色版（内置运行时）
        └── 使用说明.txt                     使用说明
```

## 第一章 · 01-code1

### kuaishou-signin
基于 Auto.js / autojs-v7 的快手自动签到脚本，配合安卓模拟器（雷电/LDPlayer）使用。

- `signin.js` / `signin-smart.js`：核心签到逻辑
- `explore.js`：自动逛视频 / 刷任务
- `detector/`：UI 元素检测辅助
- `install-to-emulator.ps1` / `push-and-run.ps1`：模拟器部署脚本
- 依赖：AutoX.js v7、雷电 9 / LDPlayer 9

### termux-tasker-master
[termux/termux-tasker](https://github.com/termux/termux-tasker) 上游源码本地备份，
用于在 Tasker 里调用 Termux 脚本。Gradle 项目，可独立构建。

### MavisReminder.apk
Mavis 提醒 APP 的已签名 APK，可直接安装到 Android 13+ 设备。

## 第二章 · 02-code2

Nuxt 3 + Vue 3 + TypeScript 个人应用，可打包成 Windows 桌面端（Electron）。

- 前端：`app/pages/`（`index` 练习、`review` 复习）、`components/`、`composables/`（语音朗读、虚拟列表）
- 服务端：`server/api/`（ping、words、question）、`server/data/words.json` 词库
- 桌面端：`electron/main.mjs` + `electron-builder.json`，`scripts/build-portable.mjs` 产出便携版
- 产物：`release/code2-portable-x64.zip` 是可直接运行的 Windows 便携版

本地开发：`pnpm install` → `pnpm dev`；打包：`pnpm build` → `node scripts/build-portable.mjs`。

## 第三章 · 03-code3

GpsRoam —— Android 虚拟定位工具，通过官方 Mock Location 接口让手机按指定地点或路线"移动"。

- `app/src/main/java/com/gpsroam/`
  - `mock/`：`MockLocationInjector.kt` 位置注入、`MockPermission.kt` 权限检测
  - `engine/`：`WanderEngine.kt` 漫游引擎、`RoutePlan.kt` 路线规划
  - `coord/`：`CoordinateConverter.kt` 坐标系转换、`GeoMath.kt`、`LatLng.kt`
  - `record/` / `data/`：轨迹录制与本地存储
  - `service/`：`WanderService.kt` 前台常驻服务
  - `ui/`：`MainActivity.kt`、`TrackLibraryActivity.kt`、`TrackPreviewView.kt`
- `screenshots/`：5 张界面截图
- `ui-prototype/`：`index.html`、`index-v1.html` 高保真 HTML 原型

自用工具，需在开发者选项里把它选为「模拟位置信息应用」后才能生效。
仓库内不含 `gradlew`，直接用 Android Studio 打开，或用本机 Gradle 构建。

## 第四章 · 04-code2.1

2026 级新生学生手册考试背诵工具，Nuxt 3 + Vue 3 + TypeScript，可打包成 Windows 桌面端（Electron）。
与 `02-code2` 同源同构，属于该项目的另一个版本。

- 前端：`app/pages/`（`index` 题库、`recite` 背诵、`progress` 进度）、`components/`（`ReciteCard.vue`、`ProgressRing.vue`）
- 服务端：`server/api/`（bank、progress）、`server/data/questions.json` 题库
- 进度：`composables/useProgress.ts` + `server/utils/progressStore.ts`；个人进度不入库（见 `server/data/progress.json`）
- 测试：`tests/bank.test.ts`、`tests/progress.test.ts`（Vitest）
- 启动脚本：`start-dev.bat`（开发模式，自动装依赖）、`start-prod.bat`（生产模式）
- 产物：`release/学生手册背诵-1.0.0.exe` 单文件绿色版（与 `06-code2.1e` 内为同一个 exe）；
  `release/win-unpacked/` 是 electron-builder 解包中间产物，可重新生成，未入库

本地开发：`pnpm install` → `pnpm dev`；测试：`pnpm test`。

## 第五章 · 05-code3.1

GpsPoint —— Android 虚拟定位工具，`03-code3`（GpsRoam）的衍生版本：同源思路、独立工程，
两个章节互不覆盖。通过官方 Mock Location 接口把手机定位到指定地点。

- `GpsPoint/app/src/main/java/com/gpspoint/`
  - `mock/`：`MockLocationInjector.kt` 位置注入、`MockPermission.kt` 权限检测
  - `data/`：`PointStore.kt` / `SavedPoint.kt` 收藏点本地存储
  - `locate/`：`RealLocationFetcher.kt` 真实定位获取
  - `service/`：`PointService.kt` 前台常驻服务
  - `MainActivity.kt`：主界面
- `screenshots/`：7 张界面截图
- `ui-prototype/`：`index.html` 高保真 HTML 原型 + `ui-design.png`
- `GpsPoint-v1.1.apk`：已构建安装包（5.3MB，普通文件入库）

自用工具，需在开发者选项里把它选为「模拟位置信息应用」后才能生效。
仓库内不含 `gradlew`，直接用 Android Studio 打开，或用本机 Gradle 构建。

## 第六章 · 06-code2.1e

`04-code2.1`（学生手册背诵）的**打包发行版**：单个 exe，不需要安装 Node.js、不需要联网，
双击即用。首次打开会把内置运行环境解压到临时目录（约 5–10 秒），属正常现象。

- `学生手册背诵-1.0.0.exe`：单文件绿色版（72.9MB，普通文件入库；未购买代码签名证书，
  SmartScreen 首次会拦截，点「更多信息」→「仍要运行」即可）
- `使用说明.txt`：数据存放位置、常见问题、快捷键说明

进度数据保存在 exe 同级目录的 `data/` 文件夹（`progress.json` 背诵进度、`main.log` 启动日志），
属于运行时个人数据，不入库（见 `.gitignore`）。

## 同步原则

备份时**不包含**以下内容（已通过 `.gitignore` 排除）：

- `kuaishou-signin/downloads/`：原始 APK 包（autojs、快手 nebula 等，~227MB）
- `kuaishou-signin/detector/_apk_cache/`：UI 元素检测缓存 APK（~229MB）
- `kuaishou-signin/{logs,debug,apk-build}/`：运行时日志、调试截图、中间编译产物
- `__pycache__/`、`node_modules/`、`.gradle/`、`build/` 等构建产物
- `02-code2/dist-fresh/`、`dist-out/`、`dist-out2/`、`dist-v3/`：electron-builder 中间产物（合计约 416MB）
- `03-code3/GpsRoam/app/build/`（~37MB）、`.gradle/`、`local.properties`、`.cxx/` 等 Android 构建产物与本地环境配置
- `04-code2.1/node_modules/`、`.nuxt/`、`.output/` 等 Nuxt/Electron 构建产物（合计约 460MB）
- `04-code2.1/release/win-unpacked/`（~268MB）：electron-builder 解包中间产物，可由 exe 重新生成
- `04-code2.1/server/data/progress.json`：个人背诵进度数据
- `05-code3.1/GpsPoint/app/build/`、`.gradle/`、`local.properties`：Android 构建产物与本地环境配置
- `06-code2.1e/data/`：运行时个人数据（背诵进度、启动日志）

`02-code2/release/` 例外 —— 作为成品备份保留，但通过 **Git LFS** 跟踪：
其中 `code2-portable-x64.zip`（323MB）、`code2.exe`（178MB）、`app.asar`（138MB×2）
均超过 GitHub 单文件 100MB 硬限制。克隆时若未安装 git-lfs，这些文件只会是指针文本。

`04-code2.1/release/学生手册背诵-1.0.0.exe` 与 `06-code2.1e/学生手册背诵-1.0.0.exe`
（各 72.9MB）未超 100MB 硬限制，按普通文件入库，不占 LFS 额度。

## 注意事项

- 仓库是 **Public**，请勿提交任何含密钥、token、个人隐私的内容。
- `termux-tasker-master/` 是上游开源项目源码，仅供本地参考。
- LFS 免费额度为 1 GiB 存储 / 1 GiB 月流量，`02-code2/release/` 已占用约 0.9 GiB，接近上限。
- 后续新增项目直接开新的 `chapters/07-xxx/` 目录提交即可。
