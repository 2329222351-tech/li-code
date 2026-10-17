// server/api/ping.get.ts
// 健康检查：Electron 主进程靠它确认 Nitro 已就绪

import type { ApiOk } from '~~/shared/types'

export default defineEventHandler((): ApiOk<{ message: string, time: string }> => {
  return {
    ok: true,
    data: {
      message: 'pong',
      time: new Date().toISOString()
    }
  }
})
