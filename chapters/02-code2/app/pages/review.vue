<script setup lang="ts">
import type { Word } from '~~/shared/types'

const log = createClientLogger('review')

// ============================================================
// 类型
// ============================================================
interface EditState {
  translation: string
  phonetic: string
  pos: string
  difficulty: number
  example: string
  example_translation: string
}

interface QueueItem {
  word: Word
  original: Word                    // 用于判断是否改动
  status: 'pending' | 'approved' | 'deleted' | 'skipped'
  edit: EditState                    // 当前编辑中的值
  dirty: boolean                     // 是否有未保存改动
}

type ReviewMode = 'sample' | 'all'

// ============================================================
// 状态
// ============================================================
const queue = ref<QueueItem[]>([])
const currentIndex = ref(0)
const mode = ref<ReviewMode>('sample')
const filterSource = ref<string>('all')
const filterDifficulty = ref<number | null>(null)
const search = ref('')
const sampleSize = ref(200)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const saving = ref(false)
const lastSaveMsg = ref<string | null>(null)

// TTS 设置面板开关
const ttsPanelOpen = ref(false)

// TTS
const { speak, supported: speechSupported, voices: ttsVoices, error: ttsError } = useSpeech()

// 虚拟列表（仅 mode='all' 用）
const VIRT_ITEM_HEIGHT = 28
const virt = useVirtualList({
  items: computed(() => visibleQueue.value),  // 见下
  itemHeight: VIRT_ITEM_HEIGHT,
  overscan: 8
})

// 当前 active 词是否在视口里（用于显示「↑ 当前」提示）
// 判定方法：active 词在 virt.items 渲染列表里 → in view
const activeItemInView = computed(() => {
  if (mode.value !== 'all') return true
  if (!currentItem.value) return true
  const target = currentItem.value.word.word
  return virt.items.value.some(e => e.item.word.word === target)
})

function scrollToActive() {
  if (mode.value !== 'all') return
  if (!currentItem.value) return
  const vIdx = visibleQueue.value.findIndex(it => it.word.word === currentItem.value!.word.word)
  if (vIdx >= 0) virt.scrollTo(vIdx)
}

// ============================================================
// 工具：根据单词查 queue 里的 index（O(n)，但只在点击时跑一次）
// ============================================================
const queueIndexByWord = computed(() => {
  const m = new Map<string, number>()
  queue.value.forEach((it, i) => m.set(it.word.word, i))
  return m
})

function selectByQueueIndex(idx: number) {
  if (idx < 0 || idx >= queue.value.length) return
  currentIndex.value = idx
  // 虚拟列表模式下，把目标行滚到视口中间
  if (mode.value === 'all') {
    // 找到该 queue idx 在 visibleQueue 里的位置
    const vIdx = visibleQueue.value.findIndex(it => it.word.word === queue.value[idx].word.word)
    if (vIdx >= 0) virt.scrollTo(vIdx)
  }
}

// ============================================================
// 加载抽样（mode='sample'）
// ============================================================
async function loadSample() {
  loading.value = true
  errorMsg.value = null
  try {
    const params: any = { count: sampleSize.value }
    if (filterSource.value !== 'all') params.source = filterSource.value
    if (filterDifficulty.value !== null) params.difficulty = filterDifficulty.value

    const res = await $fetch<{ total: number, sampled: number, words: Word[] }>('/api/words/random', { params })
    queue.value = res.words.map(w => makeQueueItem(w))
    currentIndex.value = 0
    log.info('加载抽样', { count: res.sampled, total: res.total, source: filterSource.value, difficulty: filterDifficulty.value })
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
    log.error('加载抽样失败', { error: e?.message })
  } finally {
    loading.value = false
  }
}

// ============================================================
// 加载全词库（mode='all'）
// ============================================================
async function loadAll() {
  loading.value = true
  errorMsg.value = null
  try {
    const params: any = {}
    if (filterSource.value !== 'all') params.source = filterSource.value
    if (filterDifficulty.value !== null) params.difficulty = filterDifficulty.value

    const res = await $fetch<{ total: number, words: Word[] }>('/api/words', { params })
    queue.value = res.words.map(w => makeQueueItem(w))
    currentIndex.value = 0
    log.info('加载全词库', { total: res.total, source: filterSource.value, difficulty: filterDifficulty.value })
  } catch (e: any) {
    errorMsg.value = e?.message || '加载失败'
    log.error('加载全词库失败', { error: e?.message })
  } finally {
    loading.value = false
  }
}

function makeQueueItem(w: Word): QueueItem {
  return {
    word: w,
    original: { ...w },
    status: 'pending' as const,
    edit: {
      translation: w.translation,
      phonetic: w.phonetic,
      pos: w.pos,
      difficulty: w.difficulty,
      example: w.example,
      example_translation: w.example_translation
    },
    dirty: false
  }
}

function reload() {
  if (mode.value === 'sample') loadSample()
  else loadAll()
}

// mode 切换时自动重新加载
watch(mode, () => {
  reload()
})

// ============================================================
// 字段变化时标记 dirty
// ============================================================
function markDirty() {
  if (!currentItem.value) return
  const item = currentItem.value
  const e = item.edit
  const o = item.original
  item.dirty = (
    e.translation !== o.translation ||
    e.phonetic !== o.phonetic ||
    e.pos !== o.pos ||
    e.difficulty !== o.difficulty ||
    e.example !== o.example ||
    e.example_translation !== o.example_translation
  )
}

// ============================================================
// 操作
// ============================================================
function approve() {
  if (!currentItem.value) return
  currentItem.value.status = 'approved'
  log.debug('通过', { word: currentItem.value.word.word, dirty: currentItem.value.dirty })
  // 抽样模式自动跳下一个；全词库模式停留（用户决定下一步）
  if (mode.value === 'sample') next()
}

function deleteCurrent() {
  if (!currentItem.value) return
  if (!confirm(`确定删除「${currentItem.value.word.word}」？`)) return
  currentItem.value.status = 'deleted'
  log.info('标记删除', { word: currentItem.value.word.word })
  if (mode.value === 'sample') next()
}

function skip() {
  if (!currentItem.value) return
  if (currentItem.value.status === 'pending') currentItem.value.status = 'skipped'
  log.debug('跳过', { word: currentItem.value.word.word })
  if (mode.value === 'sample') next()
}

function undo() {
  if (currentIndex.value > 0) {
    const prev = queue.value[currentIndex.value - 1]
    if (prev.status !== 'pending') {
      prev.status = 'pending'
    }
    currentIndex.value--
  }
}

function next() {
  if (currentIndex.value < queue.value.length - 1) {
    currentIndex.value++
  }
}

// ============================================================
// TTS
// ============================================================
function speakWord() {
  const it = currentItem.value
  if (!it) return
  speak(it.word.word)
}

function speakExample() {
  const it = currentItem.value
  if (!it) return
  const ex = it.word.example?.trim()
  if (!ex) return
  speak(ex)
}

// ============================================================
// 保存到后端
// ============================================================
async function saveAll() {
  saving.value = true
  lastSaveMsg.value = null
  const edits: any[] = []  // 提到 try 外，catch 块里也要读
  try {
    for (const item of queue.value) {
      if (item.status === 'deleted') {
        edits.push({ word: item.word.word, delete: true })
      } else if (item.status === 'approved' && item.dirty) {
        const e = item.edit
        const o = item.original
        const changes: any = {}
        if (e.translation !== o.translation) changes.translation = e.translation
        if (e.phonetic !== o.phonetic) changes.phonetic = e.phonetic
        if (e.pos !== o.pos) changes.pos = e.pos
        if (e.difficulty !== o.difficulty) changes.difficulty = e.difficulty
        if (e.example !== o.example) changes.example = e.example
        if (e.example_translation !== o.example_translation) changes.example_translation = e.example_translation
        if (Object.keys(changes).length > 0) {
          edits.push({ word: item.word.word, changes })
        }
      }
    }
    if (edits.length === 0) {
      lastSaveMsg.value = '没有需要保存的改动'
      return
    }
    const res = await $fetch<{ ok: boolean, updated: number, deleted: number, total: number }>('/api/words/save', {
      method: 'POST',
      body: { edits }
    })
    lastSaveMsg.value = `已保存：更新 ${res.updated} 词，删除 ${res.deleted} 词，库总 ${res.total} 词`
    log.info('保存成功', { updated: res.updated, deleted: res.deleted, total: res.total })
  } catch (e: any) {
    lastSaveMsg.value = `保存失败：${e?.message || '未知错误'}`
    log.error('保存失败', { error: e?.message, editCount: edits.length })
  } finally {
    saving.value = false
  }
}

// ============================================================
// 计算
// ============================================================
const currentItem = computed(() => queue.value[currentIndex.value])
const approvedCount = computed(() => queue.value.filter(x => x.status === 'approved').length)
const deletedCount = computed(() => queue.value.filter(x => x.status === 'deleted').length)
const skippedCount = computed(() => queue.value.filter(x => x.status === 'skipped').length)
const pendingCount = computed(() => queue.value.filter(x => x.status === 'pending').length)
const dirtyCount = computed(() => queue.value.filter(x => x.dirty && x.status === 'approved').length)
const progress = computed(() => {
  if (queue.value.length === 0) return 0
  return Math.round(((queue.value.length - pendingCount.value) / queue.value.length) * 100)
})

// 列表过滤（搜索）
const visibleQueue = computed(() => {
  if (!search.value) return queue.value
  const q = search.value.toLowerCase()
  return queue.value.filter(x => x.word.word.includes(q) || x.edit.translation.toLowerCase().includes(q))
})

// 初始化
onMounted(() => {
  loadSample()
})
</script>

<template>
  <div class="review">
    <!-- 顶部控制 -->
    <header class="control">
      <!-- 模式切换 -->
      <div class="mode-toggle">
        <label :class="{ active: mode === 'sample' }">
          <input type="radio" v-model="mode" value="sample" />
          抽样
          <input
            v-if="mode === 'sample'"
            type="number"
            v-model.number="sampleSize"
            min="10"
            max="1000"
            step="50"
            class="sample-size"
            @click.stop
          />
          词
        </label>
        <label :class="{ active: mode === 'all' }">
          <input type="radio" v-model="mode" value="all" />
          全部词
          <span class="mode-hint" v-if="mode === 'all'">（{{ queue.length }}）</span>
        </label>
      </div>

      <div class="filters">
        <label>来源
          <select v-model="filterSource">
            <option value="all">全部</option>
            <option value="ielts">仅雅思</option>
            <option value="toefl">仅托福</option>
            <option value="both">共有</option>
          </select>
        </label>
        <label>难度
          <select v-model.number="filterDifficulty">
            <option :value="null">全部</option>
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
            <option :value="5">5</option>
          </select>
        </label>
        <button @click="reload" :disabled="loading">{{ loading ? '加载中…' : '重新加载' }}</button>
        <input type="text" v-model="search" placeholder="搜索词/释义" class="search" />
      </div>

      <div class="progress-bar">
        <div class="bar" :style="{ width: progress + '%' }"></div>
        <span class="bar-text">
          <template v-if="mode === 'sample'">
            {{ progress }}% · 待 {{ pendingCount }} / 共 {{ queue.length }}
          </template>
          <template v-else>
            {{ approvedCount + deletedCount }} 个已处理 / 共 {{ queue.length }} 词
          </template>
        </span>
      </div>

      <div class="stats">
        <span class="stat approved">通过 {{ approvedCount }}</span>
        <span class="stat deleted">删除 {{ deletedCount }}</span>
        <span class="stat skipped">跳过 {{ skippedCount }}</span>
        <span class="stat dirty">待存改动 {{ dirtyCount }}</span>
        <button
          class="tts-settings-btn"
          :class="{ 'has-err': ttsError, 'no-voice': speechSupported && ttsVoices.length === 0 }"
          :title="ttsError || (speechSupported ? '打开 TTS 设置' : '浏览器不支持 TTS')"
          @click="ttsPanelOpen = true"
        >⚙ TTS</button>
        <button class="save" :disabled="saving" @click="saveAll">{{ saving ? '保存中…' : '保存到 JSON' }}</button>
      </div>
      <div v-if="lastSaveMsg" class="save-msg">{{ lastSaveMsg }}</div>
    </header>

    <p v-if="errorMsg" class="error">⚠ {{ errorMsg }}</p>

    <!-- 主体 -->
    <div v-if="queue.length > 0 && currentItem" class="main">
      <!-- 左：列表 -->
      <aside class="list">
        <!-- 抽样模式：v-for 全量 -->
        <template v-if="mode === 'sample'">
          <div
            v-for="item in visibleQueue"
            :key="item.word.word"
            :class="['list-item', `status-${item.status}`, { active: queueIndexByWord.get(item.word.word) === currentIndex }]"
            @click="selectByQueueIndex(queueIndexByWord.get(item.word.word)!)"
          >
            <span class="status-dot"></span>
            <span class="word-text">{{ item.word.word }}</span>
            <span v-if="item.dirty" class="dirty-dot" title="有改动">●</span>
          </div>
          <p v-if="visibleQueue.length === 0" class="empty">无匹配词</p>
        </template>

        <!-- 全部词模式：虚拟列表 -->
        <template v-else>
          <button
            v-if="!activeItemInView"
            class="active-pill"
            @click="scrollToActive"
            title="点击跳到当前选中词"
          >
            ↑ 当前: <strong>{{ currentItem.word.word }}</strong>
          </button>
          <div :ref="virt.setContainer" class="virt-scroll" @scroll="virt.onScroll">
            <div class="virt-spacer" :style="{ height: virt.totalHeight.value + 'px' }">
              <div
                v-for="entry in virt.items.value"
                :key="entry.item.word.word"
                :class="['list-item', `status-${entry.item.status}`, { active: queueIndexByWord.get(entry.item.word.word) === currentIndex }]"
                :style="{
                  position: 'absolute',
                  top: entry.top + 'px',
                  left: 0,
                  right: 0,
                  height: VIRT_ITEM_HEIGHT + 'px'
                }"
                @click="selectByQueueIndex(queueIndexByWord.get(entry.item.word.word)!)"
              >
                <span class="status-dot"></span>
                <span class="word-text">{{ entry.item.word.word }}</span>
                <span v-if="entry.item.dirty" class="dirty-dot" title="有改动">●</span>
              </div>
            </div>
          </div>
          <p v-if="visibleQueue.length === 0" class="empty">无匹配词</p>
        </template>
      </aside>

      <!-- 右：详情编辑 -->
      <section class="detail">
        <div class="word-header">
          <h2>{{ currentItem.word.word }}</h2>
          <button
            class="tts-btn"
            :disabled="!speechSupported"
            :title="speechSupported ? '朗读单词' : '浏览器不支持 TTS'"
            @click="speakWord"
          >🔊</button>
          <span :class="['source-badge', `src-${currentItem.word.source}`]">{{ currentItem.word.source }}</span>
        </div>

        <div class="form">
          <label>
            音标
            <input v-model="currentItem.edit.phonetic" @input="markDirty" placeholder="音标" />
          </label>
          <label>
            词性
            <input v-model="currentItem.edit.pos" @input="markDirty" placeholder="n. / v. / adj. ..." />
          </label>
          <label>
            难度
            <select v-model.number="currentItem.edit.difficulty" @change="markDirty">
              <option :value="1">1</option>
              <option :value="2">2</option>
              <option :value="3">3</option>
              <option :value="4">4</option>
              <option :value="5">5</option>
            </select>
          </label>
          <label class="full">
            释义
            <textarea v-model="currentItem.edit.translation" @input="markDirty" rows="2"></textarea>
          </label>
          <label class="full">
            <div class="example-head">
              <span>例句 (英)</span>
              <button
                v-if="currentItem.word.example"
                class="tts-btn small"
                :disabled="!speechSupported"
                :title="speechSupported ? '朗读例句' : '浏览器不支持 TTS'"
                @click="speakExample"
              >🔊 朗读</button>
            </div>
            <textarea v-model="currentItem.edit.example" @input="markDirty" rows="2"></textarea>
          </label>
          <label class="full">
            例句翻译 (中)
            <textarea v-model="currentItem.edit.example_translation" @input="markDirty" rows="2"></textarea>
          </label>
        </div>

        <div class="actions">
          <button class="btn-approve" @click="approve">✓ 通过</button>
          <button class="btn-delete" @click="deleteCurrent">✗ 删除</button>
          <button class="btn-skip" @click="skip">⏭ 跳过</button>
          <button class="btn-undo" :disabled="currentIndex === 0" @click="undo">↶ 上一条</button>
        </div>
      </section>
    </div>

    <p v-else-if="loading" class="loading">加载中…</p>
    <p v-else class="hint">先选过滤条件点「重新加载」开始校验</p>

    <!-- TTS 设置面板 -->
    <TtsSettingsPanel v-model:open="ttsPanelOpen" />
  </div>
</template>

<style scoped>
.review {
  max-width: 1200px;
  margin: 0 auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: calc(100vh - 50px);
  box-sizing: border-box;
}
.control {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 模式切换 */
.mode-toggle {
  display: flex;
  gap: 16px;
  align-items: center;
  padding-bottom: 4px;
  border-bottom: 1px dashed #eee;
}
.mode-toggle label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #444;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 6px;
  transition: background 0.15s;
}
.mode-toggle label.active {
  background: #e3f2fd;
  color: #1565c0;
  font-weight: bold;
}
.mode-toggle .sample-size {
  width: 70px;
  padding: 3px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}
.mode-toggle .mode-hint {
  font-size: 11px;
  color: #888;
  font-weight: normal;
  margin-left: 4px;
}

.filters {
  display: flex;
  gap: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.filters label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #444; }
.filters input, .filters select {
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
}
.filters .search { flex: 1; min-width: 200px; }
.filters button {
  padding: 5px 14px;
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}
.filters button:disabled { opacity: 0.5; }

.progress-bar {
  position: relative;
  height: 20px;
  background: #eee;
  border-radius: 10px;
  overflow: hidden;
}
.progress-bar .bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: linear-gradient(90deg, #4caf50, #8bc34a);
  transition: width 0.3s;
}
.progress-bar .bar-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #222;
  font-weight: bold;
}

.stats { display: flex; gap: 14px; align-items: center; font-size: 12px; flex-wrap: wrap; }
.stat { padding: 3px 10px; border-radius: 4px; }
.stat.approved { background: #e8f5e9; color: #2e7d32; }
.stat.deleted { background: #ffebee; color: #c62828; }
.stat.skipped { background: #fff3e0; color: #ef6c00; }
.stat.dirty { background: #e3f2fd; color: #1565c0; }
.save {
  margin-left: auto;
  padding: 5px 16px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: bold;
}
.save:disabled { opacity: 0.5; }
.save-msg { font-size: 12px; color: #666; }
.tts-settings-btn {
  margin-left: auto;
  margin-right: 8px;
  padding: 5px 12px;
  background: #fff;
  color: #1a1a2e;
  border: 1px solid #1a1a2e;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: bold;
}
.tts-settings-btn:hover { background: #1a1a2e; color: #fff; }
.tts-settings-btn.has-err {
  background: #ffebee;
  color: #c62828;
  border-color: #c62828;
  animation: pulse 2s infinite;
}
.tts-settings-btn.no-voice {
  background: #fff3e0;
  color: #ef6c00;
  border-color: #ef6c00;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.error {
  color: #c62828;
  background: #ffebee;
  padding: 8px 12px;
  border-radius: 6px;
  margin: 0;
}

.main {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.list {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.active-pill {
  flex: 0 0 auto;
  margin: 4px;
  padding: 4px 10px;
  background: #1565c0;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  align-self: flex-start;
  z-index: 2;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  font-family: monospace;
}
.active-pill:hover { background: #1976d2; }
.active-pill strong { font-weight: bold; }
.virt-scroll {
  flex: 1;
  overflow-y: auto;
  position: relative;
  min-height: 0;
}
.virt-spacer {
  position: relative;
  width: 100%;
}
.list-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  box-sizing: border-box;
}
.list-item:hover { background: #f0f0f0; }
.list-item.active { background: #bbdefb; }
.list-item .status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ccc; flex-shrink: 0;
}
.list-item.status-approved .status-dot { background: #4caf50; }
.list-item.status-deleted .status-dot { background: #f44336; }
.list-item.status-skipped .status-dot { background: #ff9800; }
.list-item .word-text { flex: 1; font-family: monospace; }
.list-item .dirty-dot { color: #ff5722; font-size: 8px; }
.list .empty { padding: 20px; text-align: center; color: #999; }

.detail {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.word-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}
.word-header h2 {
  margin: 0;
  font-size: 28px;
  font-family: monospace;
}
.tts-btn {
  background: #1a1a2e;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.tts-btn:hover:not(:disabled) { background: #2d3a5e; }
.tts-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tts-btn.small {
  font-size: 12px;
  padding: 3px 8px;
}
.example-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.source-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 12px;
  font-weight: bold;
  text-transform: uppercase;
}
.src-ielts { background: #fff3e0; color: #e65100; }
.src-toefl { background: #e3f2fd; color: #0d47a1; }
.src-both { background: #f3e5f5; color: #4a148c; }

.form {
  display: grid;
  grid-template-columns: 1fr 1fr 100px;
  gap: 12px;
  margin-bottom: 16px;
}
.form label {
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: #666;
  gap: 4px;
}
.form label.full { grid-column: 1 / -1; }
.form input, .form select, .form textarea {
  padding: 8px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}
.form input:focus, .form select:focus, .form textarea:focus {
  outline: none;
  border-color: #1a1a2e;
  box-shadow: 0 0 0 2px rgba(26, 26, 46, 0.1);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #eee;
}
.actions button {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}
.btn-approve { background: #4caf50; color: white; }
.btn-approve:hover { background: #43a047; }
.btn-delete { background: #f44336; color: white; }
.btn-delete:hover { background: #e53935; }
.btn-skip { background: #ff9800; color: white; }
.btn-skip:hover { background: #fb8c00; }
.btn-undo { background: #e0e0e0; color: #333; }
.btn-undo:hover:not(:disabled) { background: #d5d5d5; }
.btn-undo:disabled { opacity: 0.4; cursor: default; }

.loading, .hint {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

@media (prefers-color-scheme: dark) {
  .control, .list, .detail { background: #161618; border-color: #2a2a2d; }
  .filters input, .filters select { background: #202024; border-color: #444; color: #e6e6e6; }
  .progress-bar { background: #2a2a2d; }
  .list-item:hover { background: #202024; }
  .list-item.active { background: #1a3a5e; }
  .word-header h2 { color: #e6e6e6; }
  .form input, .form select, .form textarea { background: #202024; border-color: #444; color: #e6e6e6; }
  .actions { border-top-color: #2a2a2d; }
  .btn-undo { background: #2a2a2d; color: #aaa; }
  .mode-toggle { border-bottom-color: #2a2a2d; }
  .mode-toggle label.active { background: #1a3a5e; color: #90caf9; }
}
</style>
