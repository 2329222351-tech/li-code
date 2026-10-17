// server/api/progress.post.ts
// 整体覆盖写 progress.json。
//
// 为什么整包覆盖而不是增量补丁：
// - 进度只有 102 题，单包 ≤ 30KB，一次写比合并逻辑简单可靠
// - 客户端是唯一写入方，不存在多端冲突
//
// 防护（对齐 code2 的 words/save.post.ts）：
// 1. 进程内互斥（writeChain）：并发请求串行写
// 2. 结构校验：只接受对象 + records 数量上限，非法字段由 sanitizeProgress 静默清洗
// 3. 读 / 写 / parse 全包 try/catch，返 5xx 而不炸进程
// 4. 结构化日志

import type { ApiOk, ProgressFile } from '~~/shared/types'
import { emptyProgress, sanitizeProgress } from '~~/shared/progress'
import { createLogger } from '../utils/logger'
import { saveProgress } from '../utils/progressStore'

const log = createLogger('progress-save')

/** 单条 progress 记录的字段上限；102 题给到 5000 足够宽松 */
export const MAX_RECORDS = 5000

// 进程内互斥：把每次写串到上一个 Promise 后面
let writeChain: Promise<ProgressFile> = Promise.resolve(emptyProgress())

export default defineEventHandler(async (event): Promise<ApiOk<ProgressFile>> => {
  const body = await readBody<unknown>(event)

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    log.warn({ msg: '请求体不是对象' })
    throw createError({ statusCode: 400, statusMessage: '请求体必须是进度对象' })
  }

  const incoming = body as Record<string, unknown>
  const records = incoming.records
  if (typeof records !== 'object' || records === null || Array.isArray(records)) {
    log.warn({ msg: 'records 字段非法' })
    throw createError({ statusCode: 400, statusMessage: 'records 必须是对象' })
  }
  if (Object.keys(records).length > MAX_RECORDS) {
    log.warn({ msg: 'records 超上限', count: Object.keys(records).length, limit: MAX_RECORDS })
    throw createError({ statusCode: 413, statusMessage: `records 超过 ${MAX_RECORDS} 条上限` })
  }

  // sanitizeProgress 保证落盘数据永远是合法形状
  const clean = sanitizeProgress(body)
  clean.updatedAt = Date.now()

  const result = await (writeChain = writeChain.then(() => {
    saveProgress(clean)
    return clean
  }))

  log.info({
    msg: '进度已保存',
    records: Object.keys(clean.records).length,
    bookmarked: Object.values(clean.records).filter(r => r.bookmarked).length,
    hasSession: clean.session !== null
  })

  return { ok: true, data: result }
})
