// Shared types between client and server.
// 沿用 code2 的约定：shared/ 下的类型由前后端显式 import（不依赖自动导入）。

/** 一道题（题库只读，来自 server/data/questions.json） */
export interface QuestionItem {
  id: string
  stem: string
  options: string[]
  /** 正确选项下标（0-based） */
  answer: number
}

/** 自评结果 */
export type SelfRating = 'known' | 'fuzzy' | 'unknown'

/** 掌握等级：0 未掌握 / 1 有印象 / 2 熟悉 / 3 已掌握 */
export type MasteryLevel = 0 | 1 | 2 | 3

/** 单题进度 */
export interface QuestionProgress {
  id: string
  /** 累计判定次数（作答 + 自评都算一次） */
  attempts: number
  /** 命中次数（答对，或自评「会了」） */
  correct: number
  level: MasteryLevel
  bookmarked: boolean
  lastRating: SelfRating | null
  /** epoch ms */
  lastSeenAt: number
}

/** 背诵模式 */
export type ReciteMode = 'sequence' | 'random' | 'weak' | 'bookmark'

/** 会话快照：用于「继续上次」 */
export interface SessionSnapshot {
  mode: ReciteMode
  /** 本次队列的题目 id 顺序（随机模式洗牌后固化，保证可续） */
  order: string[]
  /** 当前停在第几条（0-based） */
  cursor: number
  startedAt: number
  answered: number
  correct: number
}

/** 按天聚合的背诵量 */
export interface DailyStat {
  /** YYYY-MM-DD（本地时区） */
  date: string
  answered: number
  correct: number
}

/** 进度文件（落盘到 progress.json） */
export interface ProgressFile {
  version: number
  updatedAt: number
  records: Record<string, QuestionProgress>
  session: SessionSnapshot | null
  dailyStats: DailyStat[]
}

/** 题库元信息 */
export interface BankMeta {
  title: string
  shortTitle: string
  total: number
  version: string
}

/** 题库接口返回 */
export interface BankPayload {
  meta: BankMeta
  questions: QuestionItem[]
}

/** 掌握度分布 + 总览 */
export interface BankSummary {
  total: number
  mastered: number
  familiar: number
  learning: number
  untouched: number
  bookmarked: number
  attempts: number
  correct: number
  /** 0-100 */
  accuracy: number
  /** 已开始背过的题数 */
  touched: number
}

/** 统一 API 响应包装（见 AGENTS.md） */
export interface ApiOk<T> {
  ok: true
  data: T
}

export interface ApiErr {
  ok: false
  error: { code: string, message: string }
}

export type ApiResult<T> = ApiOk<T> | ApiErr

/** 模式卡片文案 */
export interface ModeInfo {
  mode: ReciteMode
  label: string
  desc: string
  badge: string
}
