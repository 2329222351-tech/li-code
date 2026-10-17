// composables/useProgress.ts
// 背诵进度的单一数据源。
// - 读：GET /api/progress 一次，塞进 useState（跨页面共享）
// - 写：本地立即生效 → 400ms 防抖 → 整包 POST 覆盖
// - 所有状态迁移都走 shared/progress.ts 的纯函数，前后端 + 测试共用同一套规则

import type { ApiResult, ProgressFile, QuestionProgress, SelfRating, SessionSnapshot } from '~~/shared/types'
import {
  applyAnswer,
  applyRating,
  bumpDaily,
  createRecord,
  emptyProgress,
  sanitizeProgress,
  toggleBookmark
} from '~~/shared/progress'

const SAVE_DEBOUNCE_MS = 400

// 模块级：同一时刻只允许一个防抖计时器 / 一次在途请求
let saveTimer: ReturnType<typeof setTimeout> | null = null
let inflight: Promise<void> | null = null

export function useProgress() {
  const file = useState<ProgressFile>('progress', () => emptyProgress())
  const loaded = useState<boolean>('progress-loaded', () => false)
  const loading = useState<boolean>('progress-loading', () => false)
  const saving = useState<boolean>('progress-saving', () => false)
  const dirty = useState<boolean>('progress-dirty', () => false)
  const error = useState<string | null>('progress-error', () => null)
  const lastSavedAt = useState<number>('progress-saved-at', () => 0)

  // ---------------------------------------------------------------- 读写

  async function load(force = false): Promise<void> {
    if (loaded.value && !force) return
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiResult<ProgressFile>>('/api/progress')
      if (res.ok) file.value = sanitizeProgress(res.data)
      else error.value = res.error.message
    } catch (e) {
      error.value = e instanceof Error ? e.message : '进度读取失败'
    } finally {
      // 失败也置位，避免每次进页面都卡在 loading
      loaded.value = true
      loading.value = false
    }
  }

  function schedule(): void {
    dirty.value = true
    if (import.meta.server) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { void flush() }, SAVE_DEBOUNCE_MS)
  }

  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    if (!dirty.value || import.meta.server) return
    if (inflight) {
      // 有在途请求：等它写完再看是否还有新改动
      await inflight
      if (!dirty.value) return
    }

    // 快照一份，避免请求期间被继续修改
    const snapshot: ProgressFile = JSON.parse(JSON.stringify(file.value))

    inflight = (async () => {
      saving.value = true
      try {
        const res = await $fetch<ApiResult<ProgressFile>>('/api/progress', {
          method: 'POST',
          body: snapshot
        })
        if (res.ok) {
          lastSavedAt.value = res.data.updatedAt
          dirty.value = false
        } else {
          error.value = res.error.message
        }
      } catch (e) {
        error.value = e instanceof Error ? e.message : '进度保存失败'
      } finally {
        saving.value = false
        inflight = null
      }
    })()

    await inflight
  }

  // ---------------------------------------------------------------- 单题变更

  function recordOf(id: string): QuestionProgress {
    const cur = file.value.records[id]
    return cur ? { ...cur } : createRecord(id)
  }

  function putRecord(next: QuestionProgress, hit: boolean): void {
    file.value.records = { ...file.value.records, [next.id]: next }
    file.value.dailyStats = bumpDaily(file.value.dailyStats, next.lastSeenAt || Date.now(), hit)
    schedule()
  }

  /** 自评（会了 / 模糊 / 不会） */
  function rate(id: string, rating: SelfRating): QuestionProgress {
    const next = applyRating(recordOf(id), rating, Date.now())
    putRecord(next, rating === 'known')
    return next
  }

  /** 选择题作答 */
  function answer(id: string, correct: boolean): QuestionProgress {
    const next = applyAnswer(recordOf(id), correct, Date.now())
    putRecord(next, correct)
    return next
  }

  function bookmark(id: string): boolean {
    const next = toggleBookmark(recordOf(id))
    file.value.records = { ...file.value.records, [next.id]: next }
    schedule()
    return next.bookmarked
  }

  function setSession(session: SessionSnapshot | null): void {
    // 空 → 空 的无意义写入直接跳过（离开背诵页时会 persist 一次，别白跑一趟网络）
    if (session === null && file.value.session === null) return
    file.value.session = session
    schedule()
  }

  function resetAll(): void {
    file.value = emptyProgress()
    dirty.value = true
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    void flush()
  }

  // ---------------------------------------------------------------- 派生

  const hasStarted = computed(() => {
    const s = file.value.session
    return !!s && s.order.length > 0 && s.cursor < s.order.length
  })

  const bookmarkedIds = computed(() => {
    const ids: string[] = []
    for (const [id, r] of Object.entries(file.value.records)) {
      if (r.bookmarked) ids.push(id)
    }
    return ids
  })

  return {
    file,
    loaded,
    loading,
    saving,
    dirty,
    error,
    lastSavedAt,
    hasStarted,
    bookmarkedIds,
    load,
    flush,
    rate,
    answer,
    bookmark,
    setSession,
    resetAll,
    recordOf
  }
}
