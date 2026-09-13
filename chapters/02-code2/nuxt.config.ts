// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  // TypeScript strict mode for safer code
  typescript: {
    strict: true,
    typeCheck: false, // run via `pnpm typecheck` instead of on every save
  },

  // App-level metadata
  app: {
    head: {
      title: 'code2',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Personal web app built with Nuxt 3' },
      ],
    },
  },

  // Project uses `app/pages/` instead of the default `pages/`.
  // (app.vue stays at the project root, so we only override `pages`,
  //  not the full srcDir.)
  dir: {
    pages: 'app/pages',
  },

  // Nitro (server) - dev-only CORS for local API exploration
  nitro: {
    devProxy: {},
  },

  // Runtime config (server-only secrets, public values)
  runtimeConfig: {
    // server-only
    apiSecret: '',
    // public (exposed to client)
    public: {
      appName: 'code2',
    },
  },

  // Electron 打包说明（无 nuxt-electron 模块，纯手写 electron-builder）：
  // - pnpm dev          → 只跑 Nuxt，用浏览器访问 http://localhost:3000
  // - pnpm build        → 产 .output（Nitro server + 静态资源）
  // - pnpm exec electron ...   → 开发期本地启 Electron（指向 .output）
  // - pnpm dist:win     → electron-builder 打 NSIS + portable exe
})

