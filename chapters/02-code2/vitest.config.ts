// vitest.config.ts
// 单元测试配置。覆盖：server/utils/、server/api/（纯函数部分）、composables/（纯函数部分）
// 注意：Nuxt 的 auto-import（defineEventHandler 等）在 vitest 里没有，
// 所以测试 server 代码时需要 stub 或单独 import Nitro globals。

import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false, // 显式 import { describe, it, expect } 更清晰
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('./', import.meta.url)),
      '~': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
})
