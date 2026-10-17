import { describe, expect, it } from 'vitest'
import {
  MAX_DAILY_STATS,
  applyAnswer,
  applyRating,
  buildQueue,
  bumpDaily,
  createRecord,
  dayKey,
  emptyProgress,
  sanitizeProgress,
  streakDays,
  summarizeBank
} from '../shared/progress'
import type { QuestionItem } from '../shared/types'

const Q = (id: string): QuestionItem => ({
  id,
  stem: `题干 ${id}`,
  options: ['甲', '乙', '丙', '丁'],
  answer: 0
})

const bank = ['q1', 'q2', 'q3', 'q4'].map(Q)

describe('applyRating', () => {
  it('会了：等级 +1，且计一次命中', () => {
    const r = applyRating(createRecord('q1'), 'known', 1000)
    expect(r.level).toBe(1)
    expect(r.attempts).toBe(1)
    expect(r.correct).toBe(1)
    expect(r.lastRating).toBe('known')
    expect(r.lastSeenAt).toBe(1000)
  })

  it('模糊：等级不变，只累加次数', () => {
    const base = { ...createRecord('q1'), level: 2 as const }
    const r = applyRating(base, 'fuzzy', 1000)
    expect(r.level).toBe(2)
    expect(r.attempts).toBe(1)
    expect(r.correct).toBe(0)
  })

  it('不会：等级 -1，最低到 0 不再往下', () => {
    const base = { ...createRecord('q1'), level: 1 as const }
    expect(applyRating(base, 'unknown', 1).level).toBe(0)
    expect(applyRating(createRecord('q1'), 'unknown', 1).level).toBe(0)
  })

  it('等级封顶在 3', () => {
    let r = createRecord('q1')
    for (let i = 0; i < 10; i++) r = applyRating(r, 'known', i)
    expect(r.level).toBe(3)
  })

  it('不改入参', () => {
    const base = createRecord('q1')
    applyRating(base, 'known', 1)
    expect(base.level).toBe(0)
    expect(base.attempts).toBe(0)
  })
})

describe('applyAnswer', () => {
  it('答对升级，答错降级', () => {
    const right = applyAnswer(createRecord('q1'), true, 5)
    expect(right.level).toBe(1)
    expect(right.correct).toBe(1)
    const wrong = applyAnswer(right, false, 6)
    expect(wrong.level).toBe(0)
    expect(wrong.attempts).toBe(2)
    expect(wrong.correct).toBe(1)
  })
})

describe('buildQueue', () => {
  it('sequence 保持题库原序', () => {
    expect(buildQueue(bank, {}, 'sequence')).toEqual(['q1', 'q2', 'q3', 'q4'])
  })

  it('random 是同一批 id 的排列', () => {
    const out = buildQueue(bank, {}, 'random')
    expect(out.slice().sort()).toEqual(['q1', 'q2', 'q3', 'q4'])
  })

  it('weak 过滤掉已掌握的，未掌握的排前面', () => {
    const records = {
      q1: { ...createRecord('q1'), level: 3 as const },
      q2: { ...createRecord('q2'), level: 2 as const },
      q3: { ...createRecord('q3'), level: 0 as const }
    }
    expect(buildQueue(bank, records, 'weak')).toEqual(['q3', 'q4', 'q2'])
  })

  it('bookmark 只出收藏题', () => {
    const records = {
      q2: { ...createRecord('q2'), bookmarked: true },
      q4: { ...createRecord('q4'), bookmarked: true }
    }
    expect(buildQueue(bank, records, 'bookmark')).toEqual(['q2', 'q4'])
  })

  it('全掌握时 weak 为空数组（由页面处理空态）', () => {
    const records = Object.fromEntries(
      bank.map(q => [q.id, { ...createRecord(q.id), level: 3 as const }])
    )
    expect(buildQueue(bank, records, 'weak')).toEqual([])
  })
})

describe('bumpDaily / streakDays', () => {
  const t = new Date(2026, 9, 17, 10, 0, 0).getTime() // 2026-10-17 本地时间

  it('同一天累加', () => {
    const a = bumpDaily([], t, true)
    const b = bumpDaily(a, t, false)
    expect(b).toHaveLength(1)
    expect(b[0]).toMatchObject({ date: '2026-10-17', answered: 2, correct: 1 })
  })

  it('跨天新增一条', () => {
    const a = bumpDaily([], t, true)
    const b = bumpDaily(a, t + 86400000, true)
    expect(b).toHaveLength(2)
  })

  it('只保留最近 MAX_DAILY_STATS 天', () => {
    let stats: ReturnType<typeof bumpDaily> = []
    for (let i = 0; i < MAX_DAILY_STATS + 10; i++) stats = bumpDaily(stats, t + i * 86400000, true)
    expect(stats).toHaveLength(MAX_DAILY_STATS)
  })

  it('连续天数：断一天就停', () => {
    const stats = [
      { date: '2026-10-15', answered: 1, correct: 1 },
      { date: '2026-10-16', answered: 1, correct: 1 },
      { date: '2026-10-17', answered: 1, correct: 1 }
    ]
    expect(streakDays(stats, t)).toBe(3)
    expect(streakDays(stats, t + 86400000)).toBe(3) // 今天还没背，不算断
    expect(streakDays(stats, t + 2 * 86400000)).toBe(0)
  })

  it('dayKey 用本地时区', () => {
    expect(dayKey(new Date(2026, 0, 2, 23, 30).getTime())).toBe('2026-01-02')
  })
})

describe('summarizeBank', () => {
  it('按等级分桶并算命中率', () => {
    const records = {
      q1: { ...createRecord('q1'), level: 3 as const, attempts: 2, correct: 2 },
      q2: { ...createRecord('q2'), level: 1 as const, attempts: 2, correct: 0 },
      q3: { ...createRecord('q3'), level: 2 as const, attempts: 0, correct: 0, bookmarked: true }
    }
    const s = summarizeBank(bank, records)
    expect(s.total).toBe(4)
    expect(s.mastered).toBe(1)
    expect(s.familiar).toBe(1)
    expect(s.learning).toBe(1)
    expect(s.untouched).toBe(1)
    expect(s.bookmarked).toBe(1)
    expect(s.attempts).toBe(4)
    expect(s.correct).toBe(2)
    expect(s.accuracy).toBe(50)
    expect(s.touched).toBe(3)
  })

  it('空进度不炸', () => {
    const s = summarizeBank(bank, {})
    expect(s).toMatchObject({ total: 4, mastered: 0, attempts: 0, accuracy: 0 })
  })
})

describe('sanitizeProgress', () => {
  it('非对象输入回退空进度', () => {
    expect(sanitizeProgress(null)).toEqual(emptyProgress())
    expect(sanitizeProgress('oops')).toEqual(emptyProgress())
    expect(sanitizeProgress([1, 2])).toEqual(emptyProgress())
  })

  it('清洗越界字段', () => {
    const out = sanitizeProgress({
      version: 99,
      records: {
        q1: { id: 'q1', attempts: 5, correct: 99, level: 42, bookmarked: 'yes', lastRating: 'nope', lastSeenAt: -3 }
      },
      session: { mode: 'bogus', order: ['q1'], cursor: 0 },
      dailyStats: [{ date: '2026-13-40' }, { date: '2026-10-17', answered: 3, correct: 9 }]
    })
    const r = out.records.q1
    expect(r).toBeDefined()
    expect(r?.level).toBe(3)
    expect(r?.correct).toBe(5) // 不超过 attempts
    expect(r?.bookmarked).toBe(false)
    expect(r?.lastRating).toBeNull()
    expect(r?.lastSeenAt).toBe(0)
    expect(out.session).toBeNull()
    expect(out.dailyStats).toEqual([{ date: '2026-10-17', answered: 3, correct: 3 }])
  })

  it('cursor 越界时夹回最后一条', () => {
    const out = sanitizeProgress({
      records: {},
      session: { mode: 'sequence', order: ['q1', 'q2'], cursor: 99, startedAt: 1, answered: 2, correct: 1 }
    })
    expect(out.session?.cursor).toBe(1)
  })

  it('空 order 的 session 丢弃', () => {
    const out = sanitizeProgress({ records: {}, session: { mode: 'sequence', order: [] } })
    expect(out.session).toBeNull()
  })

  it('round-trip 稳定', () => {
    const src = sanitizeProgress({
      records: { q1: { attempts: 2, correct: 1, level: 1, bookmarked: true, lastRating: 'fuzzy', lastSeenAt: 10 } },
      session: { mode: 'weak', order: ['q1'], cursor: 0, startedAt: 1, answered: 1, correct: 1 },
      dailyStats: [{ date: '2026-10-17', answered: 1, correct: 1 }]
    })
    expect(sanitizeProgress(JSON.parse(JSON.stringify(src)))).toEqual(src)
  })
})
