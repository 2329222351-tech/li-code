// server/api/words/save.post.ts
// 接受 review 页批量编辑，写回 words.json
//
// 防护要点：
// 1. 进程内互斥（writeChain）：同一 Nitro 实例下并发 save 串行执行
//    （多进程部署请用外部锁 / 队列；本项目是个人单进程工具，足够）
// 2. 输入校验：单次 edits 上限 + 字段类型 + difficulty 范围
// 3. 读 / 写 / parse 全包 try/catch，文件损坏返 5xx，不炸进程
// 4. 删除在前、更新在后，避免反复重建索引
// 5. 全程结构化日志
// 6. 校验逻辑独立在 server/utils/validateEdits.ts，可单测

import { createLogger } from '../../utils/logger'
import { validateEdits, type SaveRequest } from '../../utils/validateEdits'
import { loadWords, saveWords } from '../../utils/wordStore'

const log = createLogger('words-save')

interface SaveResult {
  ok: true
  updated: number
  deleted: number
  total: number
  errors: string[]
}

// 进程内互斥：每次写入串到上一个 Promise 后面
let writeChain: Promise<SaveResult> = Promise.resolve({ ok: true, updated: 0, deleted: 0, total: 0, errors: [] })

export default defineEventHandler(async (event): Promise<SaveResult> => {
  const body = await readBody<SaveRequest>(event)

  if (!body || !Array.isArray(body.edits)) {
    log.warn({ msg: '请求格式错误', bodyType: typeof body })
    throw createError({ statusCode: 400, statusMessage: '请求格式错误' })
  }

  const validationErr = validateEdits(body.edits)
  if (validationErr) {
    log.warn({ msg: 'edit 校验失败', count: body.edits.length, error: validationErr })
    throw createError({ statusCode: 400, statusMessage: validationErr })
  }

  log.info({ msg: '开始保存', count: body.edits.length })

  // 把写操作串到 chain 上，保证进程内串行
  const result = await (writeChain = writeChain.then(async () => {
    let raw = loadWords() as unknown as Record<string, unknown>[]

    // 分两阶段：先删（一次性 filter），再更新（用新索引）
    const deleteWords = new Set<string>()
    const updateEdits: Array<{ word: string, changes: Record<string, unknown> }> = []

    for (const edit of body.edits) {
      if (edit.delete) deleteWords.add(edit.word)
      else if (edit.changes) updateEdits.push({ word: edit.word, changes: edit.changes as Record<string, unknown> })
    }

    const before = raw.length
    raw = raw.filter(w => !deleteWords.has(w.word as string))
    const deleted = before - raw.length

    const idx = new Map<string, number>()
    raw.forEach((w, i) => idx.set(w.word as string, i))

    let updated = 0
    const errors: string[] = []
    for (const { word, changes } of updateEdits) {
      const i = idx.get(word)
      if (i === undefined) {
        errors.push(`更新时未找到词：${word}`)
        continue
      }
      Object.assign(raw[i], changes)
      updated++
    }

    try {
      // saveWords 会同步更新缓存，下一次 read 立即看到新值
      saveWords(raw as any)
    } catch (e: any) {
      log.error({ msg: '写 words.json 失败', error: e?.message })
      throw createError({ statusCode: 500, statusMessage: '写入词库失败' })
    }

    const out: SaveResult = {
      ok: true,
      updated,
      deleted,
      total: raw.length,
      errors
    }
    log.info({
      msg: '词库保存成功',
      requested: body.edits.length,
      updated,
      deleted,
      total: raw.length,
      errorCount: errors.length
    })
    return out
  }))

  return result
})
