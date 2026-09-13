// server/api/question.get.ts
// 随机出题：返回单词 + 4 个中文选项

import type { Word, Question } from '~~/shared/types'
import { createLogger } from '../utils/logger'
import { loadWords } from '../utils/wordStore'

const log = createLogger('question')

export default defineEventHandler((event): Question => {
  const query = getQuery(event)
  const difficulty = query.difficulty ? Number(query.difficulty) : null

  let pool: Word[] = loadWords()
  if (difficulty) {
    pool = pool.filter(w => w.difficulty === difficulty)
  }

  if (pool.length < 4) {
    log.warn({ msg: '词库不足 4 词', poolSize: pool.length, difficulty })
    throw createError({ statusCode: 500, statusMessage: '词库不足 4 词，无法出题' })
  }

  // 随机选 1 个正确答案
  const correctIndex = Math.floor(Math.random() * pool.length)
  const correct = pool[correctIndex]

  // 随机选 3 个错误选项
  const wrongIndices = new Set<number>()
  while (wrongIndices.size < 3) {
    const i = Math.floor(Math.random() * pool.length)
    if (i !== correctIndex) wrongIndices.add(i)
  }
  const wrongs = Array.from(wrongIndices).map(i => pool[i].translation)

  // 4 个选项打乱
  const options = [correct.translation, ...wrongs]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }

  // 找正确选项的位置
  const finalCorrectIndex = options.indexOf(correct.translation)

  log.debug({
    msg: '出题',
    word: correct.word,
    difficulty: difficulty ?? null,
    poolSize: pool.length
  })

  return {
    word: correct,
    options,
    correctIndex: finalCorrectIndex
  }
})
