// server/api/progress.get.ts
// 读取背诵进度（progress.json）。文件缺失时返回空进度，前端据此渲染「还没开始」。

import type { ApiOk, ProgressFile } from '~~/shared/types'
import { createLogger } from '../utils/logger'
import { loadProgress } from '../utils/progressStore'

const log = createLogger('progress-get')

export default defineEventHandler((): ApiOk<ProgressFile> => {
  const file = loadProgress()
  log.debug({ msg: '读取进度', records: Object.keys(file.records).length })
  return { ok: true, data: file }
})
