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
      title: '学生手册背诵',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '2026 级新生学生手册考试 · 逐条背诵与进度记录' },
      ],
    },
  },

  // 沿用 code2 的「半 appDir」布局：pages 在 app/ 下，
  // app.vue 仍在项目根，所以只 override dir.pages，不动 srcDir。
  dir: {
    pages: 'app/pages',
  },

  // Nitro (server)
  nitro: {
    devProxy: {},
  },

  // Runtime config
  runtimeConfig: {
    // server-only
    apiSecret: '',
    // public (exposed to client)
    public: {
      appName: '学生手册背诵',
      bankTitle: '2026 级新生学生手册考试',
    },
  },
})
