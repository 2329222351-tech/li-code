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
    └── 02-code2/           ← 第二章（当前）
        ├── app/ components/ composables/   Nuxt 3 前端
        ├── server/                         Nitro 服务端 API 与词库
        ├── electron/                       Electron 主进程 / preload
        └── release/                        打包产物（Git LFS）
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

## 同步原则

备份时**不包含**以下内容（已通过 `.gitignore` 排除）：

- `kuaishou-signin/downloads/`：原始 APK 包（autojs、快手 nebula 等，~227MB）
- `kuaishou-signin/detector/_apk_cache/`：UI 元素检测缓存 APK（~229MB）
- `kuaishou-signin/{logs,debug,apk-build}/`：运行时日志、调试截图、中间编译产物
- `__pycache__/`、`node_modules/`、`.gradle/`、`build/` 等构建产物
- `02-code2/dist-fresh/`、`dist-out/`、`dist-out2/`、`dist-v3/`：electron-builder 中间产物（合计约 416MB）

`02-code2/release/` 例外 —— 作为成品备份保留，但通过 **Git LFS** 跟踪：
其中 `code2-portable-x64.zip`（323MB）、`code2.exe`（178MB）、`app.asar`（138MB×2）
均超过 GitHub 单文件 100MB 硬限制。克隆时若未安装 git-lfs，这些文件只会是指针文本。

## 注意事项

- 仓库是 **Public**，请勿提交任何含密钥、token、个人隐私的内容。
- `termux-tasker-master/` 是上游开源项目源码，仅供本地参考。
- LFS 免费额度为 1 GiB 存储 / 1 GiB 月流量，`02-code2/release/` 已占用约 0.9 GiB，接近上限。
- 后续新增项目直接开新的 `chapters/03-xxx/` 目录提交即可。
