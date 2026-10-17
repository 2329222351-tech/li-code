// server/api/bank.get.ts
// 题库加载入口：一次返回全量题目（102 题，~26KB，不值得分页）+ 元信息

import type { ApiOk, BankPayload } from '~~/shared/types'
import { createLogger } from '../utils/logger'
import { BANK_VERSION, getBankStats, loadQuestions } from '../utils/questionStore'

const log = createLogger('bank')

export default defineEventHandler((): ApiOk<BankPayload> => {
  const questions = loadQuestions()
  const stats = getBankStats()

  log.debug({ msg: '下发题库', total: stats.total })

  return {
    ok: true,
    data: {
      meta: {
        title: '2026 级新生学生手册考试',
        shortTitle: '学生手册',
        total: questions.length,
        version: BANK_VERSION
      },
      questions
    }
  }
})
