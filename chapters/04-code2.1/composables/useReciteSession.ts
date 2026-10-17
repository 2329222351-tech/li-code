// composables/useReciteSession.ts
// 逐条背诵的会话状态机。
//
// 一次「背一条」的生命周期：
//   1) 看题干，可选：点选项自测（自测路径）
//   2) 或点「看答案」→ 自评 会了 / 模糊 / 不会（背诵路径）
//   3) 进入下一条
// 两条路径互斥，保证同一次交互只记一次判定（不重复累加 attempts）。

import type { QuestionItem, ReciteMode, SelfRating } from '~~/shared/types'
import { buildQueue } from '~~/shared/progress'

export function useReciteSession() {
  const bank = useBank()
  const prog = useProgress()

  // 会话状态（useState：跨页面 / 组件保持，刷新后由 progress.session 恢复）
  const mode = useState<ReciteMode>('recite-mode', () => 'sequence')
  const order = useState<string[]>('recite-order', () => [])
  const cursor = useState<number>('recite-cursor', () => 0)
  const revealed = useState<boolean>('recite-revealed', () => false)
  const picked = useState<number | null>('recite-picked', () => null)
  const rated = useState<SelfRating | null>('recite-rated', () => null)
  const startedAt = useState<number>('recite-started-at', () => 0)
  const answered = useState<number>('recite-answered', () => 0)
  const correct = useState<number>('recite-correct', () => 0)
  const answeredIds = useState<string[]>('recite-answered-ids', () => [])

  const total = computed(() => order.value.length)
  const currentId = computed<string | null>(() => order.value[cursor.value] ?? null)
  const current = computed<QuestionItem | null>(() => {
    const id = currentId.value
    if (!id) return null
    return bank.byId.value.get(id) ?? null
  })
  const finished = computed(() => total.value > 0 && cursor.value >= total.value)
  const position = computed(() => Math.min(cursor.value + 1, Math.max(total.value, 1)))
  const accuracy = computed(() => (answered.value === 0 ? 0 : Math.round((correct.value / answered.value) * 100)))

  function resetCard(): void {
    revealed.value = false
    picked.value = null
    rated.value = null
  }

  function persist(): void {
    if (order.value.length === 0) {
      prog.setSession(null)
      return
    }
    prog.setSession({
      mode: mode.value,
      order: order.value.slice(),
      cursor: cursor.value,
      startedAt: startedAt.value,
      answered: answered.value,
      correct: correct.value
    })
  }

  /** 开始新一轮 */
  function start(nextMode: ReciteMode): number {
    mode.value = nextMode
    order.value = buildQueue(bank.questions.value, prog.file.value.records, nextMode)
    cursor.value = 0
    answered.value = 0
    correct.value = 0
    answeredIds.value = []
    startedAt.value = Date.now()
    resetCard()
    persist()
    return order.value.length
  }

  /** 用指定题目开始（错题重练 / 收藏夹抽查） */
  function startWithIds(ids: string[], nextMode: ReciteMode = 'sequence'): number {
    mode.value = nextMode
    order.value = ids.filter(id => bank.byId.value.has(id))
    cursor.value = 0
    answered.value = 0
    correct.value = 0
    answeredIds.value = []
    startedAt.value = Date.now()
    resetCard()
    persist()
    return order.value.length
  }

  /** 从 progress.session 恢复；返回是否恢复成功 */
  function resume(): boolean {
    const s = prog.file.value.session
    if (!s) return false
    const validIds = s.order.filter(id => bank.byId.value.has(id))
    if (validIds.length === 0) return false
    // 已经背到最后一条（cursor 越界）说明这轮结束了，不要把它当成「未完成」再弹出来
    if (s.cursor >= validIds.length) return false
    mode.value = s.mode
    order.value = validIds
    cursor.value = Math.min(Math.max(s.cursor, 0), validIds.length - 1)
    startedAt.value = s.startedAt || Date.now()
    answered.value = s.answered
    correct.value = s.correct
    answeredIds.value = []
    resetCard()
    return true
  }

  /** 揭开答案（背诵路径的起点） */
  function reveal(): void {
    revealed.value = true
  }

  /** 点选项自测 */
  function pick(index: number): void {
    const q = current.value
    if (!q || revealed.value) return
    picked.value = index
    revealed.value = true

    const ok = index === q.answer
    if (!answeredIds.value.includes(q.id)) {
      answeredIds.value = [...answeredIds.value, q.id]
      answered.value += 1
      if (ok) correct.value += 1
    }
    prog.answer(q.id, ok)
    persist()
  }

  /** 自评（只在「看答案」路径出现） */
  function rate(rating: SelfRating): void {
    const q = current.value
    if (!q || rated.value) return
    rated.value = rating

    if (!answeredIds.value.includes(q.id)) {
      answeredIds.value = [...answeredIds.value, q.id]
      answered.value += 1
      if (rating === 'known') correct.value += 1
    }
    prog.rate(q.id, rating)
    persist()
  }

  function bookmarkCurrent(): boolean {
    const q = current.value
    if (!q) return false
    return prog.bookmark(q.id)
  }

  function next(): void {
    if (cursor.value < order.value.length) cursor.value += 1
    resetCard()
    persist()
  }

  function prev(): void {
    if (cursor.value > 0) cursor.value -= 1
    resetCard()
    persist()
  }

  /** 结束会话：清掉快照，回到「未开始」 */
  function finish(): void {
    prog.setSession(null)
    order.value = []
    cursor.value = 0
    resetCard()
  }

  return {
    // state
    mode,
    order,
    cursor,
    revealed,
    picked,
    rated,
    startedAt,
    answered,
    correct,
    // derived
    total,
    current,
    currentId,
    finished,
    position,
    accuracy,
    // actions
    start,
    startWithIds,
    resume,
    reveal,
    pick,
    rate,
    bookmarkCurrent,
    next,
    prev,
    finish,
    persist
  }
}
