# AGENTS.md

> 这个文件按 [agents.md](https://agents.md/) 规范编写，被 OpenCode / Codex / Cursor / Aider / Devin / Gemini CLI 等多种 AI 编程工具读取。
> 项目协作约定以本文为准；详细任务说明引用本目录下的 topic 文件。

## Project: code2

- **类型**：个人 Web 全栈应用
- **技术栈**：Nuxt 3 + Vue 3 + TypeScript + Nitro（Node.js）
- **目标平台**：本地开发 + 任意 Node.js 部署（Vercel / 自建 VPS / Docker 均可）
- **包管理器**：pnpm

## Quick Start

```sh
pnpm install
pnpm dev          # http://localhost:3000
```

## Directory Layout

> 项目用了「半 appDir」布局：`pages/` 在 `app/` 下（`nuxt.config.ts` 显式设了 `dir.pages = 'app/pages'`），
> `components/` 和 `composables/` 仍在项目根。这两个写法 Nuxt 都支持，但混用时记住：**只 override `dir.pages`，不要 override `srcDir`**，否则 `app.vue` 会找不到。

| 路径 | 用途 | 导入方式 |
|---|---|---|
| `app.vue` | 根组件 | Nuxt 自动（必须在项目根，因为没改 srcDir） |
| `app/pages/` | 页面（文件路由） | Nuxt 自动 |
| `components/` | 组件 | Nuxt 自动 |
| `composables/` | 组合式函数 | Nuxt 自动 |
| `server/api/` | 后端 API routes | Nuxt 自动（`server/api/foo.get.ts` → `GET /api/foo`） |
| `server/middleware/` | Nitro 中间件 | Nuxt 自动 |
| `server/utils/` | Nitro 服务端工具（如 logger） | Nuxt 自动 |
| `server/data/` | 静态数据（如 `words.json`） | 手动 `import data from '../data/xxx.json'` |
| `server/logs/` | 服务端结构化日志（按天分文件） | 自动写 |
| `shared/` | 前后端共享类型/常量 | Nuxt 自动（3.12+） |
| `public/` | 静态资源（按需创建） | `/` 根路径 |
| `error.vue` | 全局错误页（404 / 500） | Nuxt 自动 |

## Code Conventions

- **TypeScript 严格模式**：开启（`nuxt.config.ts` 里 `typescript.strict: true`）。不要用 `any`，必要时 `unknown` + 收窄。
- **文件命名**：组件 PascalCase（`MyButton.vue`），composables camelCase（`useFoo.ts`），server routes 点分多段（`user.profile.get.ts`）。
- **API 响应格式**：成功 `{ ok: true, data: ... }`，失败 `{ ok: false, error: { code, message } }`。
- **不要把 secrets 写到 `runtimeConfig.public`**——那些会暴露到客户端。
- **共享类型放 `shared/types.ts`**：用 `import type { ... } from '~~/shared/types'` 显式 import。
  - Nuxt 3.12+ 虽然支持 `shared/` 自动导入，但**本项目目前不依赖自动导入**，统一显式 import 更稳。
  - ~~`useFetch` 的 `serverTypes` 自动推断在本项目里不启用~~。
- **服务端日志**：用 `import { createLogger } from '../utils/logger'`，按子系统起一个 `source`，输出到 `server/logs/server-YYYY-MM-DD.log` + 控制台。
- **客户端错误日志**：用 `app/utils/clientLogger.ts`（基于 console + 内存 buffer，便于复现问题）。

## Available Skills

- 无（Mavis 工具链中，code-review、ai-coder 等通用 skill 在需要时调用）

## Tasks

任务列表与说明引用本目录的 `tasks/*.md`：

- `tasks/<name>.md` —— 单个任务的详细规格、目标、验收标准

新建任务时复制 `_template.md` 模板。

## Build / Test / Deploy

- `pnpm dev` — Nuxt 开发服务器（端口 3000，hot reload，浏览器访问）
- `pnpm build` — 生产构建到 `.output/`
- `pnpm preview` — 本地预览生产构建
- `pnpm typecheck` — 静态类型检查（不参与 dev 自动检查，避免卡编辑器）
- `pnpm lint` — ESLint（flat config，规则见 `eslint.config.mjs`）
- `pnpm test` — Vitest（单元测试）
- 部署：`.output/` 是 standalone Node 应用，`node .output/server/index.mjs` 即可启动

## Electron 离线打包

> 无 `nuxt-electron` 模块（兼容性问题），纯手写 `electron/main.mjs` + `electron-builder`。

- `pnpm dev` — 浏览器开发（不启动 Electron）
- `pnpm dev:electron` — 先 `nuxt build`，再 `electron .` 本地起窗口测试
- `pnpm dist:win` — `nuxt build` + `electron-builder` 出 NSIS 安装包 + portable exe 到 `release/`

**数据目录策略**（由 `electron/main.mjs` 处理，通过 `CODE2_DATA_DIR` env 注入子进程 Nitro）：

| 模式 | 路径 |
|---|---|
| dev (`pnpm dev`) | `<项目根>/server/data` |
| portable exe | `<exe 同级>/data` |
| NSIS 安装 | `%APPDATA%/code2/data` |

首次启动从 `process.resourcesPath/data/words.json`（打包资源，由 `electron-builder.json` 的 `extraResources` 拷入）拷贝种子到上面任一位置。

**Server API 调 Nitro 子进程**：prod 模式由 `main.mjs` 拉起 `node .output/server/index.mjs` 当子进程，等 `http://127.0.0.1:3000/api/ping` 响应后才 `createWindow`，避免「窗口已开但页面 502」。

## 协作约定

- 修改前后端 API 时，同步更新 `shared/types.ts` 和 `app.vue` / 相关页面
- 加新依赖前先在 README 写明用途
- 提交前跑 `pnpm typecheck` 和 `pnpm lint` 通过再 commit
- 加新 server route 时按需 `import { createLogger } from '../utils/logger'` 记录关键事件（保存、校验失败、慢查询等）
- 涉及写文件的 API（save / delete / merge）必须在进程内互斥 + try/catch 读 / 写 / parse + 字段校验，参考 `server/api/words/save.post.ts`
