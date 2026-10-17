<script setup lang="ts">
import type { MasteryLevel, QuestionItem, QuestionProgress } from '~~/shared/types'
import { MAX_LEVEL, dayKey, levelLabel, streakDays, summarizeBank } from '~~/shared/progress'

const { questions, load: loadBank } = useBank()
const prog = useProgress()

const booting = ref(true)

onMounted(async () => {
  await loadBank()
  await prog.load()
  booting.value = false
})

type FilterKey = 'all' | 'weak' | 'bookmark' | 'wrong'

const FILTERS: ReadonlyArray<{ key: FilterKey, label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'weak', label: '未掌握' },
  { key: 'wrong', label: '做错过' },
  { key: 'bookmark', label: '收藏' }
]

const filter = ref<FilterKey>('all')

interface Row {
  q: QuestionItem
  rec: QuestionProgress | null
  level: number
  attempts: number
  correct: number
  accuracy: number
  bookmarked: boolean
}

const allRows = computed<Row[]>(() =>
  questions.value.map((q) => {
    const rec = prog.file.value.records[q.id] ?? null
    return {
      q,
      rec,
      level: rec?.level ?? 0,
      attempts: rec?.attempts ?? 0,
      correct: rec?.correct ?? 0,
      accuracy: rec && rec.attempts > 0 ? Math.round((rec.correct / rec.attempts) * 100) : 0,
      bookmarked: rec?.bookmarked ?? false
    }
  })
)

const counts = computed(() => ({
  all: allRows.value.length,
  weak: allRows.value.filter(r => r.level < MAX_LEVEL).length,
  wrong: allRows.value.filter(r => r.attempts > 0 && r.correct < r.attempts).length,
  bookmark: allRows.value.filter(r => r.bookmarked).length
}))

const rows = computed<Row[]>(() => {
  const base = allRows.value
  switch (filter.value) {
    case 'weak':
      return base.filter(r => r.level < MAX_LEVEL).sort((a, b) => a.level - b.level || a.attempts - b.attempts)
    case 'wrong':
      return base.filter(r => r.attempts > 0 && r.correct < r.attempts).sort((a, b) => a.accuracy - b.accuracy)
    case 'bookmark':
      return base.filter(r => r.bookmarked)
    default:
      return base
  }
})

const summary = computed(() => summarizeBank(questions.value, prog.file.value.records))
const masteryPct = computed(() =>
  summary.value.total === 0 ? 0 : Math.round((summary.value.mastered / summary.value.total) * 100)
)

const streak = computed(() => streakDays(prog.file.value.dailyStats, Date.now()))

/** 最近 7 天的背诵量 */
const week = computed(() => {
  const map = new Map(prog.file.value.dailyStats.map(s => [s.date, s]))
  const out: Array<{ date: string, label: string, answered: number, correct: number, isToday: boolean }> = []
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = dayKey(d.getTime())
    const stat = map.get(key)
    out.push({
      date: key,
      label: i === 0 ? '今天' : `${d.getMonth() + 1}/${d.getDate()}`,
      answered: stat?.answered ?? 0,
      correct: stat?.correct ?? 0,
      isToday: i === 0
    })
  }
  return out
})

const weekMax = computed(() => Math.max(1, ...week.value.map(d => d.answered)))

const todayAnswered = computed(() => week.value[week.value.length - 1]?.answered ?? 0)

const lastUpdate = computed(() => {
  const t = prog.file.value.updatedAt
  if (!t) return '还没有保存过进度'
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `上次保存 ${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
})

function startRecite(ids: string[]): void {
  if (ids.length === 0) return
  navigateTo(`/recite?ids=${ids.join(',')}`)
}

function retryFiltered(): void {
  startRecite(rows.value.map(r => r.q.id))
}

function resetAll(): void {
  if (typeof window === 'undefined') return
  const ok = window.confirm('确定清空全部背诵进度吗？收藏和掌握等级都会一起清掉，且无法撤销。')
  if (!ok) return
  prog.resetAll()
}

const levelCls = (level: number) => `lv lv-${level}`
const lvLabel = (level: number): string => levelLabel(level as MasteryLevel)
</script>

<template>
  <div class="page">
    <header class="head">
      <div>
        <p class="eyebrow">背诵进度</p>
        <h1>你背到哪儿了</h1>
      </div>
      <p class="sync">
        <span v-if="prog.saving.value" class="dot-pulse" />
        {{ prog.saving.value ? '正在保存…' : lastUpdate }}
      </p>
    </header>

    <p v-if="booting" class="state">正在加载…</p>

    <template v-else>
      <!-- 总览 -->
      <section class="overview card">
        <ProgressRing :value="masteryPct" :label="`${masteryPct}%`" caption="已掌握" />

        <div class="figures">
          <div class="fig">
            <b>{{ summary.mastered }}<small>/{{ summary.total }}</small></b>
            <span>已掌握</span>
          </div>
          <div class="fig">
            <b>{{ summary.attempts }}</b>
            <span>累计判定</span>
          </div>
          <div class="fig">
            <b>{{ summary.accuracy }}<small>%</small></b>
            <span>命中率</span>
          </div>
          <div class="fig">
            <b>{{ streak }}<small>天</small></b>
            <span>连续打卡</span>
          </div>
        </div>

        <div class="week">
          <div class="week-head">
            <span>最近 7 天</span>
            <span class="week-note">今天已背 {{ todayAnswered }} 条</span>
          </div>
          <div class="bars">
            <div v-for="d in week" :key="d.date" class="col" :class="{ today: d.isToday }">
              <div class="col-bar">
                <span :style="{ height: `${Math.max(3, (d.answered / weekMax) * 100)}%` }" :title="`${d.date} 背了 ${d.answered} 条`" />
              </div>
              <span class="col-n">{{ d.answered || '' }}</span>
              <span class="col-l">{{ d.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 列表 -->
      <section class="list-section">
        <div class="list-head">
          <div class="tabs">
            <button
              v-for="f in FILTERS"
              :key="f.key"
              class="tab"
              :class="{ active: filter === f.key }"
              @click="filter = f.key"
            >
              {{ f.label }}<span>{{ counts[f.key] }}</span>
            </button>
          </div>
          <div class="list-actions">
            <button class="btn sm" :disabled="rows.length === 0" @click="retryFiltered">
              重练这批（{{ rows.length }}）
            </button>
            <button class="btn sm danger" @click="resetAll">清空进度</button>
          </div>
        </div>

        <div v-if="rows.length === 0" class="empty">
          {{ filter === 'bookmark' ? '还没收藏题目，背诵时点右上角的星标就行。' : '这一类现在是空的。' }}
        </div>

        <ul v-else class="rows card">
          <li v-for="r in rows" :key="r.q.id" class="row" @click="startRecite([r.q.id])">
            <span class="idx">{{ r.q.id.replace('q', '') }}</span>
            <span class="stem">{{ r.q.stem }}</span>
            <span class="stats">
              <span v-if="r.attempts" class="acc" :class="{ low: r.accuracy < 60 }">{{ r.accuracy }}%</span>
              <span v-else class="acc none">—</span>
            </span>
            <span :class="levelCls(r.level)">{{ lvLabel(r.level) }}</span>
            <span class="star" :class="{ on: r.bookmarked }" title="收藏">
              <svg width="13" height="13" viewBox="0 0 24 24" :fill="r.bookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8">
                <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" stroke-linejoin="round" />
              </svg>
            </span>
          </li>
        </ul>

        <p class="hint">点任意一行，单独重背这一条。</p>
      </section>
    </template>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 22px;
}
.head h1 {
  margin: 8px 0 0;
  font-size: 27px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.sync {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 4px;
  font-size: 12.5px;
  color: var(--faint);
}
.dot-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ok);
  animation: pulse 1s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}

.state { padding: 60px 0; text-align: center; color: var(--muted); font-size: 14px; }

/* 总览 */
.overview {
  display: flex;
  align-items: center;
  gap: 34px;
  padding: 24px 28px;
  margin-bottom: 30px;
}
.figures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px 28px;
  flex: 1;
  min-width: 0;
}
.fig { display: flex; flex-direction: column; gap: 3px; }
.fig b {
  font-size: 21px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.fig b small { font-size: 12px; color: var(--muted); font-weight: 500; margin-left: 1px; }
.fig span { font-size: 12px; color: var(--muted); }

.week {
  flex: none;
  width: 260px;
  padding-left: 26px;
  border-left: 1px solid var(--border);
}
.week-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--muted);
}
.week-note { color: var(--faint); font-size: 11.5px; }
.bars { display: flex; gap: 6px; align-items: flex-end; height: 74px; }
.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  height: 100%;
}
.col-bar {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  border-radius: 5px;
  overflow: hidden;
}
.col-bar span {
  display: block;
  width: 100%;
  background: var(--border);
  border-radius: 5px;
  transition: height 0.4s ease;
}
.col.today .col-bar span { background: var(--accent); }
.col-n { font-size: 10.5px; color: var(--muted); font-variant-numeric: tabular-nums; height: 13px; }
.col-l { font-size: 10px; color: var(--faint); white-space: nowrap; }

/* 列表 */
.list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.tabs { display: flex; gap: 4px; }
.tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  font-family: inherit;
  font-size: 13px;
  color: var(--muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.tab:hover { background: var(--surface-2); color: var(--text); }
.tab.active {
  color: var(--text);
  background: var(--surface);
  border-color: var(--border);
  font-weight: 600;
}
.tab span {
  font-size: 11.5px;
  color: var(--faint);
  font-variant-numeric: tabular-nums;
}
.list-actions { display: flex; gap: 8px; }

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 18px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.12s;
}
.row:last-child { border-bottom: none; }
.row:hover { background: var(--surface-2); }

.idx {
  flex: none;
  width: 30px;
  font-size: 11.5px;
  color: var(--faint);
  font-variant-numeric: tabular-nums;
}
.stem {
  flex: 1;
  min-width: 0;
  font-size: 13.5px;
  color: var(--text-soft);
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stats { flex: none; }
.acc {
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.acc.low { color: var(--bad); }
.acc.none { color: var(--faint); }

.lv {
  flex: none;
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 999px;
  color: var(--muted);
  background: var(--surface-2);
  white-space: nowrap;
}
.lv-1 { color: var(--warn); background: var(--warn-soft); }
.lv-2 { color: var(--accent); background: var(--accent-soft); }
.lv-3 { color: var(--ok); background: var(--ok-soft); }

.star { flex: none; width: 16px; color: var(--faint); display: grid; place-items: center; }
.star.on { color: #b7791f; }

.empty {
  padding: 40px 20px;
  text-align: center;
  font-size: 13.5px;
  color: var(--muted);
  background: var(--surface);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}
.hint { margin: 10px 2px 0; font-size: 12px; color: var(--faint); }

@media (max-width: 820px) {
  .overview { flex-direction: column; align-items: stretch; gap: 22px; }
  .overview :deep(.ring) { align-self: center; }
  .week { width: auto; padding-left: 0; border-left: none; border-top: 1px solid var(--border); padding-top: 18px; }
}
@media (max-width: 560px) {
  .head { flex-direction: column; align-items: flex-start; }
  .stem { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .lv { display: none; }
}
</style>
