// https://nuxt.com/docs/api/configuration/nuxt-config
const isProd = process.env.NODE_ENV === 'production'

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',

  // 生产构建里不需要 devtools；它会把 Vue DevTools 的钩子打进产物
  devtools: { enabled: !isProd },

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
    // 打包产物里不带 sourcemap：省体积，也不把源码结构暴露在 exe 里
    sourceMap: false,
  },

  vite: {
    build: {
      sourcemap: false,
    },
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
