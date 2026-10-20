# AGENTS.md

> 按 [agents.md](https://agents.md/) 规范编写。本文件描述 code2.1 的结构与协作约定。
> 上游项目：`~/code2`（代码结构与约定直接继承，未做破坏性改动）。

## Project: code2.1 · 学生手册背诵

- **类型**：个人 Web 全栈应用（备考背诵工具）
- **技术栈**：Nuxt 3 + Vue 3 + TypeScript + Nitro（Node.js）
- **目标平台**：本地开发 + 任意 Node.js 部署 + Electron 离线打包
- **包管理器**：pnpm

## Quick Start

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

## Directory Layout

> 与 code2 相同的「半 appDir」布局：`pages/` 在 `app/` 下（`nuxt.config.ts` 里 `dir.pages = 'app/pages'`），
> `components/` 和 `composables/` 仍在项目根，`app.vue` 也必须在项目根。
> **只 override `dir.pages`，不要 override `srcDir`**，否则 `app.vue` 会找不到。

| 路径 | 用途 | 导入方式 |
|---|---|---|
| `app.vue` | 根组件 + 全局 CSS 变量（设计令牌） | Nuxt 自动 |
| `app/pages/` | 页面（`index` / `recite` / `progress`） | Nuxt 自动 |
| `components/` | 组件（`ReciteCard` / `ProgressRing`） | Nuxt 自动 |
| `composables/` | `useBank` / `useProgress` / `useReciteSession` | Nuxt 自动 |
| `shared/types.ts` | 前后端共享类型 | 显式 `import type { ... } from '~~/shared/types'` |
| `shared/progress.ts` | 进度纯函数（等级迁移 / 队列 / 容错解析） | 显式 `import { ... } from '~~/shared/progress'` |
| `server/api/` | Nitro API routes | Nuxt 自动 |
| `server/utils/` | `logger` / `questionStore` / `progressStore` | 显式相对路径 import |
| `server/data/questions.json` | 题库（只读，静态 import） | `import rawBank from '../data/questions.json'` |
| `tests/` | Vitest | — |
| `electron/` | 主进程 + preload（手写，无 nuxt-electron） | — |

## Code Conventions

- **TypeScript 严格模式**：开启（`typescript.strict: true`）。不用 `any`，必要时 `unknown` + 收窄。
- **文件命名**：组件 PascalCase，composables camelCase，server routes 点分多段（`progress.get.ts`）。
- **API 响应格式**：统一 `{ ok: true, data: ... }` / `{ ok: false, error: { code, message } }`。
  客户端用 `$fetch<ApiResult<T>>` 收窄。
- **状态归属**：
  - 题库是只读的 → 服务端 `questionStore` 缓存 + 客户端 `useState('bank')`
  - 进度是唯一可变状态 → `useProgress` 是**单一数据源**，所有写操作都走它
  - 会话语义（当前第几条 / 是否揭晓）只在 `useReciteSession` 里
- **纯函数优先**：任何跨端 / 可测的逻辑放 `shared/progress.ts`，不要在组件里重写一遍。
  等级迁移、队列构建、容错解析都有单测（`tests/progress.test.ts`）。
- **服务端日志**：`createLogger('source')`，输出 `server/logs/server-YYYY-MM-DD.log`。
- **写文件的 API**：必须进程内互斥（`writeChain`）+ 校验 + try/catch + 原子替换，
  参考 `server/api/progress.post.ts`。

## 数据模型要点

- `QuestionItem.answer` 是 **0-based 下标**，不是字母。显示时用 `LETTERS[answer]` 转。
- 题库存在 3 选项的题（教务办老师那几条），UI 必须容忍 `options.length !== 4`。
- `ProgressFile.records` 是 `id → QuestionProgress` 的稀疏表，没背过的题**不出现在里面**。
- 掌握等级 `MasteryLevel = 0 | 1 | 2 | 3`，语义见 README 的表格。
- `sanitizeProgress()` 是唯一的反序列化入口：磁盘文件被手改、旧版本字段缺失都不会炸。

## Build / Test / Deploy

- `pnpm dev` — 开发服务器（端口 3000，hot reload）
- `pnpm build` — 生产构建到 `.output/`
- `pnpm preview` — 本地预览生产构建
- `pnpm typecheck` — 静态类型检查
- `pnpm lint` — ESLint（flat config）
- `pnpm test` — Vitest
- 部署：`.output/` 是 standalone Node 应用，`node .output/server/index.mjs` 即可启动

## Electron 离线打包

- `pnpm dev` — 浏览器开发（不启动 Electron）
- `pnpm dev:electron` — 先 `nuxt build`，再 `electron .` 本地起窗口
- `pnpm dist:win` — `nuxt build` + `electron-builder` 出**单文件 portable exe** 到 `release/`
- `pnpm dist:dir` — 只出 `win-unpacked/`，排查打包问题时用（不压缩，快）
- 国内网络：electron-builder 要拉 NSIS/winCodeSign，加
  `ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/`
- `.output` 走 `extraResources` 拷到 `resources/nitro`，**不要放 asar / asarUnpack**
  （asar 里的 node_modules 会被依赖规则过滤，Nitro 起来直接 500）
- `win.signAndEditExecutable: false`：非管理员环境解压 winCodeSign 会因 darwin 符号链接失败，
  关掉 rcedit 才能稳定打包；图标/版本号由外层 NSIS exe 提供

**数据目录策略**（`electron/main.mjs` 通过 `CODE21_DATA_DIR` 注入子进程 Nitro）：

| 模式 | 路径 |
|---|---|
| dev | `<项目根>/server/data` |
| portable exe | `<exe 同级>/data` |
| 其他打包形态（如安装版） | `%APPDATA%/学生手册背诵/data` |

题库打包进 Nitro bundle（静态 import），所以不需要 seed 文件；只有 `progress.json` 落在数据目录。

## 协作约定

- 改题库 → 同步跑 `pnpm test`（`tests/bank.test.ts` 会校验 102 题、答案下标、重复题干）
- 改等级规则 / 队列逻辑 → 先改 `shared/progress.ts` 再补 `tests/progress.test.ts`
- 改前后端契约 → 同步 `shared/types.ts`
- 提交前跑 `pnpm typecheck` + `pnpm lint` + `pnpm test`
- **不要修改 `D:\gr\code2`**，那是上游参考工程，本项目是独立副本
