// server/api/words.get.ts
// 返回词库（顺序/全集），支持 source / difficulty / limit 过滤
// review 页「全部词」模式走这里，能力对齐 /api/words/random

import type { Word } from '~~/shared/types'
import { createLogger } from '../utils/logger'
import { loadWords } from '../utils/wordStore'

const log = createLogger('words-list')

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const source = query.source as string | undefined          // 'ielts' | 'toefl' | 'both'
  const difficulty = query.difficulty ? Number(query.difficulty) : null
  const limit = query.limit ? Number(query.limit) : null

  let result: Word[] = loadWords()

  if (source) {
    result = result.filter(w => w.source === source)
  }
  if (difficulty) {
    result = result.filter(w => w.difficulty === difficulty)
  }
  if (limit && limit > 0) {
    result = result.slice(0, limit)
  }

  log.debug({
    msg: '查询词库',
    source: source ?? null,
    difficulty,
    limit,
    total: result.length
  })

  return {
    total: result.length,
    words: result
  }
})
