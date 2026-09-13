// server/api/words/random.get.ts
// 给 review 页随机抽词，支持按 source/difficulty 过滤

import type { Word } from '~~/shared/types'
import { createLogger } from '../../utils/logger'
import { loadWords } from '../../utils/wordStore'

const log = createLogger('words-random')

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const count = query.count ? Math.min(Number(query.count), 1000) : 50
  const source = query.source as string | undefined  // 'ielts' | 'toefl' | 'both' | undefined
  const difficulty = query.difficulty ? Number(query.difficulty) : null

  let pool: Word[] = loadWords()

  if (source) {
    pool = pool.filter(w => w.source === source)
  }
  if (difficulty) {
    pool = pool.filter(w => w.difficulty === difficulty)
  }

  // 简单随机抽样
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, count)

  log.debug({
    msg: '随机抽词',
    requested: count,
    source: source ?? null,
    difficulty,
    poolSize: pool.length,
    sampled: sample.length
  })

  return {
    total: pool.length,
    sampled: sample.length,
    words: sample
  }
})
