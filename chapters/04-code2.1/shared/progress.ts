// shared/progress.ts
// 背诵进度的纯函数层：不碰 DOM / fs，前后端共用，可被 vitest 直接单测。
// 设计原则：所有状态变更都返回新对象（不改入参），便于 Vue 响应式与回滚。

import type {
  BankSummary,
  DailyStat,
  MasteryLevel,
  ProgressFile,
  QuestionItem,
  QuestionProgress,
  ReciteMode,
  SelfRating,
  SessionSnapshot
} from './types'

export const MAX_LEVEL = 3
export const PROGRESS_VERSION = 1
/** 只保留最近 N 天的背诵记录，避免 progress.json 无限膨胀 */
export const MAX_DAILY_STATS = 60

const MODES: readonly ReciteMode[] = ['sequence', 'random', 'weak', 'bookmark']
const RATINGS: readonly SelfRating[] = ['known', 'fuzzy', 'unknown']

// ---------------------------------------------------------------------------
// 基础工具
// ---------------------------------------------------------------------------

export function clampLevel(n: number): MasteryLevel {
  if (!Number.isFinite(n)) return 0
  const i = Math.round(n)
  if (i <= 0) return 0
  if (i >= MAX_LEVEL) return MAX_LEVEL
  return i as MasteryLevel
}

export function levelLabel(level: MasteryLevel): string {
  switch (level) {
    case 3: return '已掌握'
    case 2: return '熟悉'
    case 1: return '有印象'
    default: return '未掌握'
  }
}

/** 本地时区的 YYYY-MM-DD */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function createRecord(id: string): QuestionProgress {
  return {
    id,
    attempts: 0,
    correct: 0,
    level: 0,
    bookmarked: false,
    lastRating: null,
    lastSeenAt: 0
  }
}

export function emptyProgress(): ProgressFile {
  return {
    version: PROGRESS_VERSION,
    updatedAt: 0,
    records: {},
    session: null,
    dailyStats: []
  }
}

// ---------------------------------------------------------------------------
// 单题状态迁移
// ---------------------------------------------------------------------------

/**
 * 自评：会了 +1 级，模糊持平，不会 -1 级。
 * 自评也算一次判定：「会了」计命中，其余计未命中。
 */
export function applyRating(
  rec: QuestionProgress,
  rating: SelfRating,
  now: number
): QuestionProgress {
  const delta = rating === 'known' ? 1 : rating === 'unknown' ? -1 : 0
  return {
    ...rec,
    attempts: rec.attempts + 1,
    correct: rec.correct + (rating === 'known' ? 1 : 0),
    level: clampLevel(rec.level + delta),
    lastRating: rating,
    lastSeenAt: now
  }
}

/** 选择题作答：对 +1 级，错 -1 级。 */
export function applyAnswer(
  rec: QuestionProgress,
  correct: boolean,
  now: number
): QuestionProgress {
  return {
    ...rec,
    attempts: rec.attempts + 1,
    correct: rec.correct + (correct ? 1 : 0),
    level: clampLevel(rec.level + (correct ? 1 : -1)),
    lastRating: correct ? 'known' : 'unknown',
    lastSeenAt: now
  }
}

export function toggleBookmark(rec: QuestionProgress): QuestionProgress {
  return { ...rec, bookmarked: !rec.bookmarked }
}

/** 累加当天统计；只保留最近 MAX_DAILY_STATS 天。 */
export function bumpDaily(
  stats: readonly DailyStat[],
  now: number,
  hit: boolean
): DailyStat[] {
  const date = dayKey(now)
  const next = stats.map(s => ({ ...s }))
  const hit0 = next.find(s => s.date === date)
  if (hit0) {
    hit0.answered += 1
    if (hit) hit0.correct += 1
  } else {
    next.push({ date, answered: 1, correct: hit ? 1 : 0 })
  }
  next.sort((a, b) => a.date.localeCompare(b.date))
  return next.slice(-MAX_DAILY_STATS)
}

/** 连续打卡天数（从今天往回数，允许今天还没背） */
export function streakDays(stats: readonly DailyStat[], now: number): number {
  const set = new Set(stats.filter(s => s.answered > 0).map(s => s.date))
  const cursor = new Date(now)
  cursor.setHours(12, 0, 0, 0)
  // 今天没背不算断卡
  if (!set.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (set.has(dayKey(cursor.getTime())) && n < 3650) {
    n += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

// ---------------------------------------------------------------------------
// 队列构建
// ---------------------------------------------------------------------------

export function shuffle<T>(items: readonly T[], rand: () => number = Math.random): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

/**
 * 按模式生成题目 id 队列。
 * - sequence：题库原序
 * - random：洗牌（一次固化，保证「继续上次」能续上）
 * - weak：level < 3，先按等级升序，再按最久没看排序
 * - bookmark：收藏题，按题库原序
 */
export function buildQueue(
  questions: readonly QuestionItem[],
  records: Record<string, QuestionProgress>,
  mode: ReciteMode,
  rand: () => number = Math.random
): string[] {
  const ids = questions.map(q => q.id)
  switch (mode) {
    case 'random':
      return shuffle(ids, rand)
    case 'weak': {
      const weak = questions.filter(q => (records[q.id]?.level ?? 0) < MAX_LEVEL)
      return weak
        .slice()
        .sort((a, b) => {
          const ra = records[a.id]
          const rb = records[b.id]
          const la = ra?.level ?? 0
          const lb = rb?.level ?? 0
          if (la !== lb) return la - lb
          return (ra?.lastSeenAt ?? 0) - (rb?.lastSeenAt ?? 0)
        })
        .map(q => q.id)
    }
    case 'bookmark':
      return questions.filter(q => records[q.id]?.bookmarked).map(q => q.id)
    default:
      return ids
  }
}

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------

export function summarizeBank(
  questions: readonly QuestionItem[],
  records: Record<string, QuestionProgress>
): BankSummary {
  let mastered = 0
  let familiar = 0
  let learning = 0
  let bookmarked = 0
  let attempts = 0
  let correct = 0
  let touched = 0

  for (const q of questions) {
    const r = records[q.id]
    const level = r?.level ?? 0
    if (level >= 3) mastered += 1
    else if (level === 2) familiar += 1
    else if (level === 1) learning += 1
    if (r?.bookmarked) bookmarked += 1
    if (r && (r.attempts > 0 || r.level > 0)) touched += 1
    attempts += r?.attempts ?? 0
    correct += r?.correct ?? 0
  }

  return {
    total: questions.length,
    mastered,
    familiar,
    learning,
    untouched: questions.length - mastered - familiar - learning,
    bookmarked,
    attempts,
    correct,
    accuracy: attempts === 0 ? 0 : Math.round((correct / attempts) * 100),
    touched
  }
}

// ---------------------------------------------------------------------------
// 反序列化（容错：磁盘文件被手改 / 旧版本 / 字段缺失都不该炸）
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function toCount(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0
}

function sanitizeRecord(raw: unknown, id: string): QuestionProgress {
  const base = createRecord(id)
  if (!isPlainObject(raw)) return base
  const rating = raw.lastRating
  return {
    id,
    attempts: toCount(raw.attempts),
    correct: Math.min(toCount(raw.correct), toCount(raw.attempts)),
    level: clampLevel(typeof raw.level === 'number' ? raw.level : 0),
    bookmarked: raw.bookmarked === true,
    lastRating: typeof rating === 'string' && (RATINGS as readonly string[]).includes(rating)
      ? (rating as SelfRating)
      : null,
    lastSeenAt: toCount(raw.lastSeenAt)
  }
}

function sanitizeSession(raw: unknown): SessionSnapshot | null {
  if (!isPlainObject(raw)) return null
  const mode = raw.mode
  if (typeof mode !== 'string' || !(MODES as readonly string[]).includes(mode)) return null
  const order = Array.isArray(raw.order)
    ? raw.order.filter((x): x is string => typeof x === 'string')
    : []
  if (order.length === 0) return null
  const cursor = Math.min(toCount(raw.cursor), order.length - 1)
  return {
    mode: mode as ReciteMode,
    order,
    cursor,
    startedAt: toCount(raw.startedAt),
    answered: toCount(raw.answered),
    correct: Math.min(toCount(raw.correct), toCount(raw.answered))
  }
}

/** YYYY-MM-DD 且是真实存在的日期（挡掉 2026-13-40 这种） */
function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parts = value.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function sanitizeDaily(raw: unknown): DailyStat[] {
  if (!Array.isArray(raw)) return []
  const out: DailyStat[] = []
  for (const item of raw) {
    if (!isPlainObject(item)) continue
    if (typeof item.date !== 'string' || !isValidDateKey(item.date)) continue
    out.push({
      date: item.date,
      answered: toCount(item.answered),
      correct: Math.min(toCount(item.correct), toCount(item.answered))
    })
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return out.slice(-MAX_DAILY_STATS)
}

/** 把任意输入洗成合法的 ProgressFile；不抛异常。 */
export function sanitizeProgress(input: unknown): ProgressFile {
  if (!isPlainObject(input)) return emptyProgress()

  const records: Record<string, QuestionProgress> = {}
  if (isPlainObject(input.records)) {
    for (const [id, value] of Object.entries(input.records)) {
      if (!id) continue
      records[id] = sanitizeRecord(value, id)
    }
  }

  return {
    version: PROGRESS_VERSION,
    updatedAt: toCount(input.updatedAt),
    records,
    session: sanitizeSession(input.session),
    dailyStats: sanitizeDaily(input.dailyStats)
  }
}
