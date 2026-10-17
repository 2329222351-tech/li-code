// vitest.config.ts
// 单元测试配置。覆盖 shared/ 下的纯函数与题库数据完整性。
// shared/ 不依赖 Nuxt runtime，所以这些测试不用启 Nitro、也不用 stub auto-import。

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
