// server/utils/questionStore.ts
// 题库（只读）读取入口。
// 题库是构建时固化进产物的，所以这里用静态 import，而不是运行时读盘：
// - 打包后 .output 里没有 server/data 目录，静态 import 不会踩空
// - 102 题 ~26KB，进 bundle 无压力
// - 用户不会编辑题库（进度才需要落盘，见 progressStore.ts）

import type { QuestionItem } from '~~/shared/types'
import rawBank from '../data/questions.json'

export const BANK_VERSION = '2026.10'

/** 校验题库结构，返回干净副本；结构不合法直接抛错（启动即暴露问题，别等到出题时） */
export function validateBank(input: unknown): QuestionItem[] {
  if (!Array.isArray(input)) throw new Error('题库顶层必须是数组')
  if (input.length === 0) throw new Error('题库为空')

  const seen = new Set<string>()
  const out: QuestionItem[] = []

  input.forEach((item, i) => {
    if (typeof item !== 'object' || item === null) throw new Error(`题库第 ${i + 1} 项不是对象`)
    const q = item as Record<string, unknown>

    if (typeof q.id !== 'string' || !q.id) throw new Error(`题库第 ${i + 1} 项缺少 id`)
    if (seen.has(q.id)) throw new Error(`题库 id 重复：${q.id}`)
    seen.add(q.id)

    if (typeof q.stem !== 'string' || !q.stem.trim()) {
      throw new Error(`题目 ${q.id} 题干为空`)
    }
    if (!Array.isArray(q.options) || q.options.length < 2) {
      throw new Error(`题目 ${q.id} 选项不足 2 个`)
    }
    const options = q.options.map((o) => {
      if (typeof o !== 'string') throw new Error(`题目 ${q.id} 存在非字符串选项`)
      return o.trim()
    })
    if (options.some(o => !o)) throw new Error(`题目 ${q.id} 存在空选项`)

    const answer = q.answer
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer >= options.length) {
      throw new Error(`题目 ${q.id} 答案下标越界`)
    }

    out.push({ id: q.id, stem: q.stem.trim(), options, answer })
  })

  return out
}

let cache: QuestionItem[] | null = null

export function loadQuestions(): QuestionItem[] {
  if (cache) return cache
  cache = validateBank(rawBank)
  return cache
}

export function getBankStats(): { total: number, minOptions: number, maxOptions: number } {
  const qs = loadQuestions()
  const counts = qs.map(q => q.options.length)
  return {
    total: qs.length,
    minOptions: Math.min(...counts),
    maxOptions: Math.max(...counts)
  }
}
