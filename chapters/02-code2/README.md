# code2

个人 Web 全栈应用脚手架，基于 **Nuxt 3 + Vue 3 + TypeScript**。

## 技术栈

- **Nuxt 3**（Vue 3 + Nitro 一体化全栈）
- **TypeScript**（严格模式）
- **Vite**（构建，开发服务器）

## 目录结构

```
code2/
├── app.vue                 # 根组件（也可以拆到 app/app.vue）
├── nuxt.config.ts          # Nuxt 配置
├── package.json
├── tsconfig.json
├── app/                    # 客户端代码（可选拆分）
│   ├── pages/              # 文件路由
│   ├── components/         # 组件
│   ├── composables/        # 组合式函数
│   └── ...
├── server/                 # Nitro 后端
│   └── api/                # server routes → /api/*
└── shared/                 # 前后端共享类型/常量
    └── types.ts
```

> Nuxt 默认约定目录，不需要 `src/` 包裹。如果想强制用 `srcDir: 'app/'`，改 `nuxt.config.ts`。

## 常用命令

```sh
pnpm install            # 装依赖（首次）
pnpm dev                # 启动开发服务器 (http://localhost:3000)
pnpm build              # 生产构建
pnpm preview            # 本地预览生产构建
pnpm typecheck          # 类型检查（vue-tsc）
```

## API 示例

`server/api/ping.get.ts` 暴露一个健康检查：

```sh
curl http://localhost:3000/api/ping
# {"ok":true,"message":"pong","time":"2026-08-26T..."}
```

## 接下来可以加

- UI 库：@nuxt/ui、Element Plus、Naive UI
- 状态管理：Pinia（`@pinia/nuxt`）
- 数据库：Prisma + SQLite / Postgres
- 鉴权：nuxt-auth-utils / Sidebase nuxt-auth
- 部署：Vercel / Netlify / Cloudflare Pages / Node 独立部署
