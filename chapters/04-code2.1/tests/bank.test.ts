// 题库数据完整性测试：题库是手工从 docx 抽出来的，结构错了要在 CI 阶段就炸，
// 而不是等到用户背到第 87 条才发现答案下标越界。

import { describe, expect, it } from 'vitest'
import { BANK_VERSION, loadQuestions, validateBank } from '../server/utils/questionStore'

const questions = loadQuestions()

describe('题库结构', () => {
  it('共 102 题', () => {
    expect(questions).toHaveLength(102)
  })

  it('id 连续且唯一（q001 … q102）', () => {
    expect(questions.map(q => q.id)).toEqual(
      Array.from({ length: 102 }, (_, i) => `q${String(i + 1).padStart(3, '0')}`)
    )
  })

  it('每题都有题干和至少两个选项', () => {
    for (const q of questions) {
      expect(q.stem.trim().length, `${q.id} 题干为空`).toBeGreaterThan(0)
      expect(q.options.length, `${q.id} 选项不足`).toBeGreaterThanOrEqual(2)
      expect(q.options.every(o => o.trim().length > 0), `${q.id} 存在空选项`).toBe(true)
    }
  })

  it('答案下标都在选项范围内', () => {
    for (const q of questions) {
      expect(q.answer, `${q.id} 答案越界`).toBeGreaterThanOrEqual(0)
      expect(q.answer, `${q.id} 答案越界`).toBeLessThan(q.options.length)
    }
  })

  it('选项内容在同一题内不重复', () => {
    // q083 原始 docx 里 A、B 两条选项都是「1.5」，属于出题方的疏漏。
    // 忠实保留原文，不擅自改答案；白名单之外的重复一律报错。
    const KNOWN_DUPLICATES = new Set(['q083'])
    for (const q of questions) {
      if (KNOWN_DUPLICATES.has(q.id)) continue
      const set = new Set(q.options.map(o => o.trim()))
      expect(set.size, `${q.id} 有重复选项`).toBe(q.options.length)
    }
  })

  it('题干不重复（重复题会让「逐条背诵」白背一遍）', () => {
    const set = new Set(questions.map(q => q.stem))
    expect(set.size).toBe(questions.length)
  })

  it('版本号非空', () => {
    expect(BANK_VERSION).toMatch(/^\d{4}\.\d{2}$/)
  })
})

describe('抽查若干条（对照原始 docx）', () => {
  const byId = new Map(questions.map(q => [q.id, q]))

  it('q001：代考认定 → D 严重作弊', () => {
    const q = byId.get('q001')
    expect(q?.stem).toContain('请人代考者')
    expect(q?.options[q.answer]).toBe('严重作弊')
  })

  it('q002：纪律处分种类 → C（五档）', () => {
    const q = byId.get('q002')
    expect(q?.options[q.answer]).toBe('警告，严重警告，记过，留校察看，开除学籍')
  })

  it('q041：选项缺 B 前缀的那条，按位置补回了 B', () => {
    const q = byId.get('q041')
    expect(q?.options).toHaveLength(4)
    expect(q?.options[1]).toContain('所有成员')
    expect(q?.options[q.answer]).toContain('所有成员')
  })

  it('q068：选项全部没有字母前缀，按位置补 A–D', () => {
    const q = byId.get('q068')
    expect(q?.options).toEqual(['中和楼302', '中和楼304', '中和楼202', '中和楼301'])
    expect(q?.options[q.answer]).toBe('中和楼202')
  })

  it('q076：选项是裸数字 1–4', () => {
    const q = byId.get('q076')
    expect(q?.options).toEqual(['1', '2', '3', '4'])
    expect(q?.options[q.answer]).toBe('1')
  })

  it('q100：每周卫生检查 → 全A', () => {
    const q = byId.get('q100')
    expect(q?.options[q.answer]).toBe('全A')
  })
})

describe('validateBank 会把坏数据挡在门外', () => {
  it('非数组', () => {
    expect(() => validateBank({})).toThrow(/数组/)
  })
  it('空题库', () => {
    expect(() => validateBank([])).toThrow(/为空/)
  })
  it('id 重复', () => {
    expect(() => validateBank([
      { id: 'q1', stem: 'a', options: ['1', '2'], answer: 0 },
      { id: 'q1', stem: 'b', options: ['1', '2'], answer: 0 }
    ])).toThrow(/重复/)
  })
  it('答案越界', () => {
    expect(() => validateBank([{ id: 'q1', stem: 'a', options: ['1', '2'], answer: 5 }])).toThrow(/越界/)
  })
  it('空选项', () => {
    expect(() => validateBank([{ id: 'q1', stem: 'a', options: ['1', '  '], answer: 0 }])).toThrow(/空选项/)
  })
})
