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
| `pnpm dist:win` | 打 Windows NSIS 安装包 + portable exe 到 `release/` |

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
