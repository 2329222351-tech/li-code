<script setup lang="ts">
import type { ModeInfo, ReciteMode } from '~~/shared/types'
import { MAX_LEVEL, summarizeBank } from '~~/shared/progress'

const { questions, meta, error: bankError, load: loadBank } = useBank()
const prog = useProgress()

const booting = ref(true)

onMounted(async () => {
  await loadBank()
  await prog.load()
  booting.value = false
})

const summary = computed(() => summarizeBank(questions.value, prog.file.value.records))

const masteryPct = computed(() =>
  summary.value.total === 0 ? 0 : Math.round((summary.value.mastered / summary.value.total) * 100)
)

const weakCount = computed(() =>
  questions.value.filter(q => (prog.file.value.records[q.id]?.level ?? 0) < MAX_LEVEL).length
)

const modes = computed<ModeInfo[]>(() => [
  {
    mode: 'sequence',
    label: '顺序背诵',
    desc: '按题库原序一条条过，适合第一遍打基础',
    badge: `${summary.value.total} 条`
  },
  {
    mode: 'random',
    label: '随机抽背',
    desc: '打乱顺序，避免靠题号位置蒙答案',
    badge: '乱序'
  },
  {
    mode: 'weak',
    label: '只练没掌握的',
    desc: '未掌握和有印象的排前面，最久没看的优先',
    badge: `${weakCount.value} 条`
  },
  {
    mode: 'bookmark',
    label: '收藏夹',
    desc: '你标了星的题，考前集中扫一遍',
    badge: `${summary.value.bookmarked} 条`
  }
])

function isDisabled(m: ModeInfo): boolean {
  if (m.mode === 'bookmark' && summary.value.bookmarked === 0) return true
  if (m.mode === 'weak' && weakCount.value === 0) return true
  return false
}

function go(m: ReciteMode): void {
  navigateTo(`/recite?mode=${m}`)
}

const session = computed(() => prog.file.value.session)
const sessionProgress = computed(() => {
  const s = session.value
  if (!s) return 0
  return s.order.length === 0 ? 0 : Math.round((s.cursor / s.order.length) * 100)
})

const modeLabel = computed(() => {
  const m = session.value?.mode
  return modes.value.find(x => x.mode === m)?.label ?? '顺序背诵'
})

const distribution = computed(() => {
  const s = summary.value
  const total = Math.max(s.total, 1)
  return [
    { key: 'mastered', label: '已掌握', n: s.mastered, cls: 'c-mastered' },
    { key: 'familiar', label: '熟悉', n: s.familiar, cls: 'c-familiar' },
    { key: 'learning', label: '有印象', n: s.learning, cls: 'c-learning' },
    { key: 'untouched', label: '未掌握', n: s.untouched, cls: 'c-untouched' }
  ].map(d => ({ ...d, pct: (d.n / total) * 100 }))
})
</script>

<template>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">{{ meta?.title || '2026 级新生学生手册考试' }}</p>
      <h1>逐条背诵</h1>
      <p class="sub">
        针对学生手册考试的单选题库，一条一条过。进度自动存在本机，关掉窗口再打开可以接着背。
      </p>
    </header>

    <p v-if="booting" class="state">正在加载题库…</p>

    <template v-else-if="questions.length">
      <!-- 总览 -->
      <section class="overview card">
        <ProgressRing :value="masteryPct" caption="已掌握" :label="`${masteryPct}%`" />
        <div class="overview-body">
          <div class="figures">
            <div class="figure">
              <span class="n">{{ summary.total }}</span>
              <span class="k">题库总数</span>
            </div>
            <div class="figure">
              <span class="n">{{ summary.mastered }}</span>
              <span class="k">已掌握</span>
            </div>
            <div class="figure">
              <span class="n">{{ summary.touched }}</span>
              <span class="k">背过</span>
            </div>
            <div class="figure">
              <span class="n">{{ summary.accuracy }}<small>%</small></span>
              <span class="k">命中率</span>
            </div>
          </div>

          <div class="dist">
            <div class="dist-bar">
              <span
                v-for="d in distribution"
                :key="d.key"
                class="seg"
                :class="d.cls"
                :style="{ width: `${d.pct}%` }"
                :title="`${d.label} ${d.n}`"
              />
            </div>
            <ul class="legend">
              <li v-for="d in distribution" :key="d.key">
                <i class="dot" :class="d.cls" />{{ d.label }}<b>{{ d.n }}</b>
              </li>
              <li><i class="dot c-star" />收藏<b>{{ summary.bookmarked }}</b></li>
            </ul>
          </div>
        </div>
      </section>

      <!-- 继续上次 -->
      <section v-if="session" class="resume card">
        <div class="resume-main">
          <span class="pill">上次未背完</span>
          <p>
            {{ modeLabel }} · 停在第 <strong>{{ Math.min(session.cursor + 1, session.order.length) }}</strong> 条，
            已作答 {{ session.answered }} 条
          </p>
          <div class="mini-bar"><span :style="{ width: `${sessionProgress}%` }" /></div>
        </div>
        <button class="btn primary" @click="go(session.mode)">继续背诵 →</button>
      </section>

      <!-- 模式 -->
      <section class="modes">
        <h2 class="section-title">选个方式开始</h2>
        <div class="mode-grid">
          <button
            v-for="m in modes"
            :key="m.mode"
            class="mode card"
            :class="{ disabled: isDisabled(m) }"
            :disabled="isDisabled(m)"
            @click="go(m.mode)"
          >
            <div class="mode-top">
              <span class="mode-label">{{ m.label }}</span>
              <span class="mode-badge">{{ m.badge }}</span>
            </div>
            <p class="mode-desc">{{ m.desc }}</p>
            <span class="mode-go">开始 →</span>
          </button>
        </div>
      </section>

      <!-- 快捷键 -->
      <section class="tips card">
        <h2 class="section-title">背诵页可以全键盘操作</h2>
        <ul>
          <li><kbd>1</kbd>–<kbd>4</kbd> 或 <kbd>A</kbd>–<kbd>D</kbd> 选择选项</li>
          <li><kbd>空格</kbd> 看答案</li>
          <li><kbd>←</kbd> <kbd>→</kbd> 上一条 / 下一条</li>
          <li><kbd>B</kbd> 收藏当前这条</li>
          <li>看答案后：<kbd>1</kbd> 会了 · <kbd>2</kbd> 模糊 · <kbd>3</kbd> 不会</li>
        </ul>
      </section>
    </template>

    <div v-else class="state error">
      <p>题库没加载出来{{ bankError ? `：${bankError}` : '。' }}</p>
      <button class="btn" @click="loadBank(true)">重试</button>
    </div>
  </div>
</template>

<style scoped>
.hero { margin-bottom: 26px; }
.hero h1 {
  margin: 8px 0 10px;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.hero .sub {
  margin: 0;
  max-width: 560px;
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--muted);
}

.state {
  padding: 48px 0;
  text-align: center;
  color: var(--muted);
  font-size: 14px;
}
.state.error p { margin-bottom: 14px; }

/* 总览 */
.overview {
  display: flex;
  align-items: center;
  gap: 30px;
  padding: 24px 28px;
  margin-bottom: 16px;
}
.overview-body { flex: 1; min-width: 0; }

.figures {
  display: flex;
  gap: 30px;
  padding-bottom: 18px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.figure { display: flex; flex-direction: column; gap: 3px; }
.figure .n {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
  line-height: 1.15;
}
.figure .n small { font-size: 13px; font-weight: 500; color: var(--muted); margin-left: 1px; }
.figure .k { font-size: 12px; color: var(--muted); }

.dist-bar {
  display: flex;
  height: 7px;
  width: 100%;
  border-radius: 999px;
  overflow: hidden;
  background: var(--surface-3);
}
.dist-bar .seg { display: block; height: 100%; transition: width 0.4s ease; }
.seg.c-mastered, .dot.c-mastered { background: #2f6f4e; }
.seg.c-familiar, .dot.c-familiar { background: #6c9a7f; }
.seg.c-learning, .dot.c-learning { background: #b9c6bf; }
.seg.c-untouched, .dot.c-untouched { background: var(--border); }
.dot.c-star { background: #c9973f; }

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
  font-size: 12.5px;
  color: var(--muted);
}
.legend li { display: inline-flex; align-items: center; gap: 6px; }
.legend b { color: var(--text-soft); font-weight: 600; font-variant-numeric: tabular-nums; }
.legend .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }

/* 继续上次 */
.resume {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 22px;
  margin-bottom: 30px;
  border-color: var(--border-strong);
}
.resume-main { flex: 1; min-width: 0; }
.pill {
  display: inline-block;
  padding: 2px 9px;
  margin-bottom: 8px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 999px;
}
.resume p { margin: 0 0 10px; font-size: 14px; color: var(--text-soft); }
.resume p strong { color: var(--text); font-variant-numeric: tabular-nums; }
.mini-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
}
.mini-bar span { display: block; height: 100%; background: var(--accent); transition: width 0.4s; }

/* 模式 */
.section-title {
  margin: 0 0 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--muted);
}

.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 34px;
}

.mode {
  display: block;
  padding: 18px 20px 16px;
  text-align: left;
  font-family: inherit;
  color: inherit;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.12s, box-shadow 0.15s;
}
.mode:hover:not(:disabled) {
  border-color: var(--border-strong);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 18, 28, 0.09);
}
.mode:disabled { opacity: 0.5; cursor: not-allowed; }

.mode-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 7px;
}
.mode-label { font-size: 15.5px; font-weight: 650; }
.mode-badge {
  font-size: 11.5px;
  color: var(--muted);
  background: var(--surface-2);
  border-radius: 999px;
  padding: 2px 9px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.mode-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--muted);
}
.mode-go { font-size: 13px; font-weight: 600; color: var(--accent); }

/* 提示 */
.tips { padding: 18px 22px 20px; }
.tips ul {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 13px;
  color: var(--muted);
}

@media (max-width: 720px) {
  .overview { flex-direction: column; align-items: stretch; gap: 20px; }
  .overview :deep(.ring) { align-self: center; }
  .figures { gap: 18px; justify-content: space-between; }
  .mode-grid { grid-template-columns: 1fr; }
  .resume { flex-direction: column; align-items: stretch; }
  .hero h1 { font-size: 26px; }
}
</style>
