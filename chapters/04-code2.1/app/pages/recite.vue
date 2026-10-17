<script setup lang="ts">
import type { MasteryLevel, ReciteMode, SelfRating } from '~~/shared/types'
import { levelLabel } from '~~/shared/progress'

const route = useRoute()
const { questions, load: loadBank } = useBank()
const prog = useProgress()

const {
  mode,
  current,
  currentId,
  revealed,
  picked,
  rated,
  finished,
  position,
  total,
  cursor,
  answered,
  correct,
  start,
  startWithIds,
  resume,
  reveal,
  pick,
  rate,
  bookmarkCurrent,
  next,
  prev,
  persist
} = useReciteSession()

const booting = ref(true)
const emptyMsg = ref<string | null>(null)
const flash = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null

const VALID_MODES: readonly ReciteMode[] = ['sequence', 'random', 'weak', 'bookmark']

const MODE_NAMES: Record<ReciteMode, string> = {
  sequence: '顺序背诵',
  random: '随机抽背',
  weak: '只练没掌握的',
  bookmark: '收藏夹'
}

const modeName = computed(() => MODE_NAMES[mode.value])

function toast(text: string): void {
  flash.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => { flash.value = null }, 1600)
}

const level = computed<MasteryLevel>(() => {
  const id = currentId.value
  if (!id) return 0
  return prog.file.value.records[id]?.level ?? 0
})

const currentBookmarked = computed(() => {
  const id = currentId.value
  if (!id) return false
  return prog.file.value.records[id]?.bookmarked ?? false
})

const seenCount = computed(() => {
  const id = currentId.value
  if (!id) return 0
  return prog.file.value.records[id]?.attempts ?? 0
})

const sessionAccuracy = computed(() =>
  answered.value === 0 ? 0 : Math.round((correct.value / answered.value) * 100)
)

const queuePct = computed(() =>
  total.value === 0 ? 0 : Math.round((Math.min(cursor.value, total.value) / total.value) * 100)
)

async function boot(): Promise<void> {
  await loadBank()
  await prog.load()

  if (questions.value.length === 0) {
    emptyMsg.value = '题库没加载出来，回首页重试。'
    booting.value = false
    return
  }

  const qMode = typeof route.query.mode === 'string' ? route.query.mode : ''
  const qIds = typeof route.query.ids === 'string' ? route.query.ids.split(',').filter(Boolean) : []
  const wantMode = (VALID_MODES as readonly string[]).includes(qMode) ? (qMode as ReciteMode) : null

  if (qIds.length > 0) {
    const n = startWithIds(qIds, wantMode ?? 'sequence')
    if (n === 0) emptyMsg.value = '这批题目已经不在题库里了。'
  } else if (wantMode) {
    const n = start(wantMode)
    if (n === 0) {
      emptyMsg.value = wantMode === 'bookmark'
        ? '还没有收藏任何题目。'
        : '没有需要重练的题目了 —— 全部都掌握了。'
    }
  } else if (!resume()) {
    start('sequence')
  }

  booting.value = false
}

onMounted(() => {
  void boot()
  window.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (flashTimer) clearTimeout(flashTimer)
  persist()
  void prog.flush()
})

function rateAndNext(r: SelfRating): void {
  rate(r)
  if (r === 'known') toast('熟练度 +1')
  else if (r === 'unknown') toast('已记入待复习')
  window.setTimeout(() => next(), 160)
}

function toggleBookmark(): void {
  toast(bookmarkCurrent() ? '已收藏' : '已取消收藏')
}

function restart(): void {
  emptyMsg.value = null
  const n = start(mode.value)
  if (n === 0) emptyMsg.value = '这个模式下已经没有题目了。'
}

function onKey(e: KeyboardEvent): void {
  const target = e.target as HTMLElement | null
  if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
  if (e.metaKey || e.ctrlKey || e.altKey) return

  const q = current.value
  if (!q) return

  if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
    return
  }
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
    return
  }
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (!revealed.value) reveal()
    else if (picked.value !== null) next()
    return
  }
  if (e.key === 'b' || e.key === 'B') {
    e.preventDefault()
    toggleBookmark()
    return
  }

  const byLetter = ['A', 'B', 'C', 'D', 'E', 'F'].indexOf(e.key.toUpperCase())
  const byNumber = /^[1-6]$/.test(e.key) ? Number(e.key) - 1 : -1

  if (!revealed.value) {
    const idx = byLetter >= 0 ? byLetter : byNumber
    if (idx >= 0 && idx < q.options.length) {
      e.preventDefault()
      pick(idx)
    }
    return
  }

  // 看答案之后：1/2/3 是自评，不再当选项用
  if (picked.value === null && !rated.value) {
    if (e.key === '1') { e.preventDefault(); rateAndNext('known') }
    else if (e.key === '2') { e.preventDefault(); rateAndNext('fuzzy') }
    else if (e.key === '3') { e.preventDefault(); rateAndNext('unknown') }
  }
}
</script>

<template>
  <div class="page narrow">
    <p v-if="booting" class="state">正在加载…</p>

    <div v-else-if="emptyMsg" class="empty card">
      <h2>{{ emptyMsg }}</h2>
      <div class="empty-actions">
        <button class="btn primary" @click="navigateTo('/')">回题库首页</button>
        <button v-if="questions.length" class="btn" @click="restart">从顺序第一题开始</button>
      </div>
    </div>

    <section v-else-if="finished" class="done card">
      <p class="eyebrow">本轮完成</p>
      <h1>这 {{ total }} 条过完了</h1>
      <div class="done-figures">
        <div><b>{{ answered }}</b><span>作答</span></div>
        <div><b>{{ correct }}</b><span>答对</span></div>
        <div><b>{{ sessionAccuracy }}<small>%</small></b><span>命中率</span></div>
      </div>
      <div class="done-actions">
        <button class="btn primary" @click="restart">再来一轮</button>
        <button class="btn" @click="navigateTo('/progress')">看看整体进度</button>
        <button class="btn ghost" @click="navigateTo('/')">回首页</button>
      </div>
    </section>

    <template v-else-if="current">
      <div class="topline">
        <div class="bar-wrap">
          <div class="bar"><span :style="{ width: `${queuePct}%` }" /></div>
          <span class="bar-label">{{ modeName }} · {{ position }} / {{ total }}</span>
        </div>
        <div class="topline-right">
          <span class="level" :data-level="level">{{ levelLabel(level) }}</span>
          <button class="btn ghost sm" @click="navigateTo('/')">退出</button>
        </div>
      </div>

      <ReciteCard
        :key="currentId ?? 'empty'"
        :question="current"
        :revealed="revealed"
        :picked="picked"
        :bookmarked="currentBookmarked"
        :index="position"
        :total="total"
        @pick="pick"
        @toggle-bookmark="toggleBookmark"
      />

      <div class="actions">
        <template v-if="!revealed">
          <button class="btn" :disabled="cursor === 0" @click="prev()">← 上一条</button>
          <button class="btn primary wide" @click="reveal()">看答案 <kbd>space</kbd></button>
          <button class="btn" @click="next()">跳过</button>
        </template>

        <template v-else-if="picked === null">
          <button class="rate known" :class="{ on: rated === 'known' }" @click="rateAndNext('known')">
            <b>会了</b><span><kbd>1</kbd></span>
          </button>
          <button class="rate fuzzy" :class="{ on: rated === 'fuzzy' }" @click="rateAndNext('fuzzy')">
            <b>模糊</b><span><kbd>2</kbd></span>
          </button>
          <button class="rate unknown" :class="{ on: rated === 'unknown' }" @click="rateAndNext('unknown')">
            <b>不会</b><span><kbd>3</kbd></span>
          </button>
        </template>

        <template v-else>
          <button class="btn" @click="prev()">← 上一条</button>
          <button class="btn primary wide" @click="next()">下一条 →</button>
        </template>
      </div>

      <footer class="footline">
        <span v-if="seenCount">这条已经看过 {{ seenCount }} 次</span>
        <span v-else>第一次见这条</span>
        <span class="keys">
          <kbd>1</kbd>–<kbd>4</kbd> 选项 · <kbd>space</kbd> 看答案 · <kbd>←</kbd><kbd>→</kbd> 翻条 · <kbd>B</kbd> 收藏
        </span>
      </footer>
    </template>

    <Transition name="fade">
      <div v-if="flash" class="flash">{{ flash }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.state { padding: 60px 0; text-align: center; color: var(--muted); font-size: 14px; }

.topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.bar-wrap { flex: 1; min-width: 0; }
.bar {
  height: 5px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
  margin-bottom: 7px;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 999px;
  transition: width 0.35s ease;
}
.bar-label { font-size: 12.5px; color: var(--muted); }

.topline-right { display: flex; align-items: center; gap: 10px; flex: none; }
.level {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  color: var(--muted);
  background: var(--surface-2);
  border: 1px solid var(--border);
  white-space: nowrap;
}
.level[data-level="1"] { color: var(--warn); background: var(--warn-soft); border-color: transparent; }
.level[data-level="2"] { color: var(--accent); background: var(--accent-soft); border-color: transparent; }
.level[data-level="3"] { color: var(--ok); background: var(--ok-soft); border-color: transparent; }

.actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}
.actions > .btn { flex: none; }
.actions .wide { flex: 1; }
.actions kbd { opacity: 0.65; }

.rate {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 8px;
  font-family: inherit;
  font-size: 14.5px;
  border-radius: 11px;
  border: 1.5px solid var(--border);
  background: var(--surface);
  color: var(--text-soft);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.rate b { font-weight: 650; }
.rate span { font-size: 11px; color: var(--faint); }
.rate:hover { border-color: var(--border-strong); background: var(--surface-2); }
.rate.known:hover, .rate.known.on { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.rate.fuzzy:hover, .rate.fuzzy.on { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); }
.rate.unknown:hover, .rate.unknown.on { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }

.footline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
  font-size: 12.5px;
  color: var(--faint);
}
.footline .keys { display: inline-flex; align-items: center; gap: 3px; flex-wrap: wrap; }

.done { padding: 40px 34px 34px; text-align: center; }
.done h1 { margin: 8px 0 26px; font-size: 26px; letter-spacing: -0.01em; }
.done-figures {
  display: flex;
  justify-content: center;
  gap: 48px;
  padding-bottom: 26px;
  margin-bottom: 26px;
  border-bottom: 1px solid var(--border);
}
.done-figures div { display: flex; flex-direction: column; gap: 4px; }
.done-figures b {
  font-size: 28px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.done-figures b small { font-size: 14px; color: var(--muted); font-weight: 500; }
.done-figures span { font-size: 12px; color: var(--muted); }
.done-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

.empty { padding: 44px 30px; text-align: center; }
.empty h2 { margin: 0 0 22px; font-size: 18px; font-weight: 600; line-height: 1.6; }
.empty-actions { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }

.flash {
  position: fixed;
  left: 50%;
  bottom: 40px;
  transform: translateX(-50%);
  padding: 9px 18px;
  font-size: 13px;
  color: #fff;
  background: rgba(20, 22, 28, 0.88);
  border-radius: 999px;
  pointer-events: none;
  z-index: 50;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s, transform 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translate(-50%, 6px); }

@media (max-width: 560px) {
  .actions { flex-wrap: wrap; }
  .done-figures { gap: 26px; }
  .footline .keys { display: none; }
}
</style>
