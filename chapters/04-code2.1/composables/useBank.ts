// composables/useBank.ts
// 题库加载：全量拉一次，缓存在 useState 里，跨页面复用。
// 并发调用共用同一个请求（否则第二个页面可能拿到空题库就渲染空态）。

import type { ApiResult, BankPayload, QuestionItem } from '~~/shared/types'

let pending: Promise<void> | null = null

export function useBank() {
  const payload = useState<BankPayload | null>('bank', () => null)
  const loading = useState<boolean>('bank-loading', () => false)
  const error = useState<string | null>('bank-error', () => null)

  const questions = computed<QuestionItem[]>(() => payload.value?.questions ?? [])
  const meta = computed(() => payload.value?.meta ?? null)
  const byId = computed<Map<string, QuestionItem>>(() => {
    const map = new Map<string, QuestionItem>()
    for (const q of questions.value) map.set(q.id, q)
    return map
  })

  async function fetchBank(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await $fetch<ApiResult<BankPayload>>('/api/bank')
      if (res.ok) payload.value = res.data
      else error.value = res.error.message
    } catch (e) {
      error.value = e instanceof Error ? e.message : '题库加载失败'
    } finally {
      loading.value = false
      pending = null
    }
  }

  async function load(force = false): Promise<void> {
    if (payload.value && !force) return
    if (pending) return pending
    pending = fetchBank()
    return pending
  }

  return { payload, questions, meta, byId, loading, error, load }
}
