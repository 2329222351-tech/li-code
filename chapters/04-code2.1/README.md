# code2.1 · 学生手册背诵

> 基于 `~/code2`（Nuxt 3 + Vue 3 + TS 的个人 Web 应用骨架）扩展出来的**备考背诵工具**。
> 题库来自《2026 级新生学生手册考试》，共 102 道单项选择题。

## 这是什么

把一份 102 题的选择题库做成「一条一条背」的工具，而不是刷题游戏：

- **题库加载**：启动即加载全量题库，本地缓存，断网也能背
- **逐条背诵**：一次只显示一条，先回忆再揭晓；支持点选项自测、看答案自评、收藏重点题
- **进度记录**：每题的掌握等级（未掌握 / 有印象 / 熟悉 / 已掌握）、作答次数、命中率、每日背诵量、连续打卡天数
- **断点续背**：会话位置（模式 + 队列 + 停在第几条）自动落盘，关掉窗口也能接着背
- **四种模式**：顺序背诵 / 随机抽背 / 只练没掌握的 / 收藏夹
- **全键盘操作**：`1`–`4` 选项、`空格` 看答案、`←`/`→` 翻条、`B` 收藏

## 快速开始

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

## 换一台电脑怎么跑

只需要 **Node.js ≥ 20** 和 **pnpm**，不需要数据库、不需要改配置。

**1. 装运行时**

```sh
node -v              # 要 ≥ v20，推荐 22 LTS
corepack enable      # 让 pnpm 随 Node 一起可用
pnpm -v              # 确认能打印版本号
```

没装 pnpm 也可以 `npm i -g pnpm`。

**2. 拷项目**

把整个 `code2.1` 文件夹复制到新电脑，**但不要带这三个目录**（都是本机生成物，换个环境必须重装）：

```
node_modules/   .nuxt/   .output/
```

`server/data/questions.json`（题库）必须一起拷，丢了就没有题了。

**3. 装依赖 + 启动**

```sh
cd code2.1
pnpm install
pnpm dev
```

浏览器打开 http://localhost:3000 即可。

**不打包桌面版就跳过 Electron 下载**（可以省 ~100MB 和一次容易失败的下载）：

```sh
# PowerShell
$env:ELECTRON_SKIP_BINARY_DOWNLOAD=1; pnpm install
# bash / Git Bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 pnpm install
```

**4. Windows 双击启动**

项目根有两个 `.bat`，双击即可（首次会自动装依赖 / 构建）：

- `start-dev.bat` —— 开发模式，改代码即时热更新
- `start-prod.bat` —— 先构建再以生产模式跑，启动快、更省内存

**要不要把进度一起搬过去？**

进度存在 `server/data/progress.json`（`pnpm dev` 和 `start-prod.bat` 都是这个位置）。
想让新电脑接着背，就把这个文件一起拷过去；不拷就是全新开始。

## 常用命令

| 命令 | 作用 |
|---|---|
| `pnpm dev` | 开发服务器（浏览器，端口 3000） |
| `pnpm build` | 生产构建到 `.output/` |
| `pnpm preview` | 预览生产构建 |
| `pnpm typecheck` | 静态类型检查 |
| `pnpm lint` | ESLint（flat config） |
| `pnpm test` | Vitest（题库完整性 + 进度纯函数） |
| `pnpm dev:electron` | 先 build 再用 Electron 开窗口 |
| `pnpm dist:win` | 打单文件 portable exe 到 `release/` |
| `pnpm dist:dir` | 只出 `win-unpacked/`（调试打包问题用，快） |

## 打包成单文件 exe

```sh
pnpm dist:win
# 或（不重新构建前端，只重打包）
pnpm exec electron-builder --win portable --config electron-builder.json
```

产物：`release/学生手册背诵-1.0.0.exe`，**一个文件，69.6 MB**，双击即用。

**国内网络注意**：electron-builder 首次要下载 NSIS 等打包工具，默认从 GitHub 拉会超时，加镜像：

```sh
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
  pnpm dist:win
```

**为什么是 portable 而不是绿色版文件夹**：portable 目标会把 `win-unpacked/` 整个用 7z 压进
exe 的 NSIS 自解压壳里，运行时解压到 `%TEMP%` 再启动。所以它是真正的一个文件，
代价是首次/每次启动多 5–10 秒解压。

**打包结构**

| 部分 | 位置 | 说明 |
|---|---|---|
| Electron 运行时 | exe 内 | 自带 Chromium + Node，目标机不需要装任何环境 |
| 主进程代码 | `resources/app.asar` | 仅 `electron/*.mjs` + `package.json`，9 KB |
| Nitro 服务端 | `resources/nitro/` | `.output` 通过 `extraResources` 拷出，**不能进 asar** |
| 题库 | 打进 Nitro bundle | 静态 import，无需外部文件 |
| 进度 | `<exe 同级>/data/progress.json` | 运行时生成 |

> `.output` 之所以不能用 `asarUnpack`：asar 内的 `node_modules` 会被 electron-builder 的
> 依赖规则过滤，Nitro 起来后 500。用 `extraResources` 拷到 `resources/nitro` 最稳，
> 但目录名不能叫 `app`，否则 Electron 会把它当成未打包应用优先加载。

**精简了什么**

- `package.json` 的 `dependencies` 清空 —— 运行时依赖全被 Nitro 打进 `.output`，
  electron-builder 因此不会把 771 MB 的 `node_modules` 塞进 exe
- 移除未使用的 `@nuxt/eslint`（ESLint 走自写的 flat config，不需要 Nuxt 模块）
- 生产构建关 sourcemap（`nitro.sourceMap: false` + `vite.build.sourcemap: false`）并关掉 devtools
- `files` 只白名单 `electron/**` + `package.json`，`tests/`、`app/`、配置文件都不进包
- `asar: true` + `compression: maximum`
- `signAndEditExecutable: false`：跳过 rcedit/签名（见下方「已知限制」）

**已知限制**

- exe 未做代码签名，首次运行会被 Windows SmartScreen 拦一次，点「更多信息 → 仍要运行」。
- `signAndEditExecutable: false` 是因为 electron-builder 解压 winCodeSign 时要为 macOS
  的 dylib 建符号链接，非管理员/未开开发者模式会失败。影响：`resources` 里的内部 exe
  保留 Electron 默认图标；外层 exe 的图标、版本号、产品名仍然是本项目的信息。

## 目录结构

沿用 code2 的「半 appDir」布局（只 override `dir.pages`，`app.vue` 仍在项目根）：

```
app.vue                  根组件 + 全局设计令牌（CSS 变量）
app/pages/index.vue      题库概览 / 模式选择
app/pages/recite.vue     逐条背诵
app/pages/progress.vue   进度统计 + 逐题列表
components/ReciteCard.vue    背诵卡片（题干 + 选项 + 揭晓态）
components/ProgressRing.vue  SVG 圆环进度
composables/useBank.ts       题库加载
composables/useProgress.ts   进度读写（防抖落盘）
composables/useReciteSession.ts  背诵会话状态机
shared/types.ts          前后端共享类型
shared/progress.ts       进度纯函数（等级迁移 / 队列构建 / 容错解析）
server/api/bank.get.ts       题库接口
server/api/progress.get.ts   读进度
server/api/progress.post.ts  写进度（进程内互斥 + 原子替换）
server/data/questions.json   题库（102 题）
build/icon.ico           exe 图标（16–256 六个尺寸）
start-dev.bat / start-prod.bat   Windows 双击启动
tests/                   Vitest
electron/                Electron 主进程 + preload
```

## 数据与落盘

- **题库**：`server/data/questions.json`，构建时静态 import 进 bundle，只读。
- **进度**：`progress.json`，写到数据目录（`CODE21_DATA_DIR`）：
  - dev → `<项目根>/server/data/progress.json`
  - portable → `<exe 同级>/data/progress.json`
  - 安装版 → `%APPDATA%/学生手册背诵/data/progress.json`
- 写入策略：本地先改 → 400ms 防抖 → 整包 `POST /api/progress` 覆盖；先写 `.tmp` 再 `rename`，避免中断留半截文件。

## 掌握度规则

每次判定（点选项作答，或看答案后自评）都会调整掌握等级：

| 动作 | 等级变化 | 计入命中 |
|---|---|---|
| 答对 / 自评「会了」 | +1（上限 3） | 是 |
| 自评「模糊」 | 不变 | 否 |
| 答错 / 自评「不会」 | −1（下限 0） | 否 |

「只练没掌握的」模式取 `level < 3`，按等级升序、再按最久没看的排前面。

## 依赖

运行时只有 `nuxt` / `vue` / `vue-router`，没有引入 UI 库、状态库、图表库 ——
圆环、柱状图、卡片都是手写 SVG/CSS，避免为了 102 道题背一个组件库。

## 与 code2 的关系

`D:\gr\code2.1` 是独立副本，**没有修改 `D:\gr\code2` 的任何文件**。
保留自 code2 的结构与约定：半 appDir 布局、`{ ok, data }` API 包装、`server/utils/logger.ts` 结构化日志、
`electron/main.mjs` 手写打包（无 nuxt-electron）、`shared/` 显式 import。
