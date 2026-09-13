<script setup lang="ts">
import type { Question, GameState } from '~~/shared/types'

const log = createClientLogger('game')

const state = ref<GameState>({
  currentLevel: 1,
  score: 0,
  combo: 0,
  maxCombo: 0,
  totalAnswered: 0,
  totalCorrect: 0,
  wrongWords: []
})

const currentQuestion = ref<Question | null>(null)
const loading = ref(false)
const errorMsg = ref<string | null>(null)
const selectedIndex = ref<number | null>(null)
const showResult = ref(false)
const isCorrect = ref(false)

async function loadQuestion() {
  loading.value = true
  errorMsg.value = null
  selectedIndex.value = null
  showResult.value = false
  try {
    currentQuestion.value = await $fetch<Question>('/api/question')
    log.debug('出题成功', { word: currentQuestion.value?.word.word })
  } catch (e: any) {
    errorMsg.value = e?.message || '出题失败'
    currentQuestion.value = null
    log.error('出题失败', { error: e?.message })
  } finally {
    loading.value = false
  }
}

function selectOption(index: number) {
  if (showResult.value || !currentQuestion.value) return
  selectedIndex.value = index
  isCorrect.value = index === currentQuestion.value.correctIndex

  state.value.totalAnswered++
  if (isCorrect.value) {
    state.value.totalCorrect++
    state.value.combo++
    state.value.score += 10 * state.value.combo
    if (state.value.combo > state.value.maxCombo) {
      state.value.maxCombo = state.value.combo
    }
  } else {
    state.value.combo = 0
    state.value.wrongWords.push(currentQuestion.value.word.word)
  }
  showResult.value = true
  log.info('答题', {
    word: currentQuestion.value.word.word,
    correct: isCorrect.value,
    combo: state.value.combo,
    score: state.value.score
  })
}

function next() {
  loadQuestion()
}

function reset() {
  state.value = {
    currentLevel: 1,
    score: 0,
    combo: 0,
    maxCombo: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    wrongWords: []
  }
  log.info('重置游戏')
  loadQuestion()
}

const accuracy = computed(() => {
  if (state.value.totalAnswered === 0) return 0
  return Math.round((state.value.totalCorrect / state.value.totalAnswered) * 100)
})

onMounted(() => {
  loadQuestion()
})
</script>

<template>
  <div class="game">
    <header class="status-bar">
      <div class="cell">
        <span class="label">关卡</span>
        <span class="value">{{ state.currentLevel }}</span>
      </div>
      <div class="cell">
        <span class="label">分数</span>
        <span class="value">{{ state.score }}</span>
      </div>
      <div class="cell">
        <span class="label">连击</span>
        <span class="value">{{ state.combo }} 🔥</span>
      </div>
    </header>

    <main v-if="currentQuestion" class="question">
      <div class="word-card">
        <div class="word">{{ currentQuestion.word.word }}</div>
        <div class="phonetic">{{ currentQuestion.word.phonetic }}</div>
        <div class="pos">{{ currentQuestion.word.pos }} · 难度 {{ currentQuestion.word.difficulty }}</div>
      </div>

      <div class="options">
        <button
          v-for="(opt, i) in currentQuestion.options"
          :key="i"
          :class="[
            'option',
            showResult && i === currentQuestion.correctIndex && 'correct',
            showResult && selectedIndex === i && !isCorrect && 'wrong'
          ]"
          :disabled="showResult"
          @click="selectOption(i)"
        >
          {{ opt }}
        </button>
      </div>

      <div v-if="showResult" class="result">
        <p v-if="isCorrect" class="success">✓ 正确！+{{ 10 * state.combo }} 分</p>
        <p v-else class="failure">
          ✗ 错了，正确答案是：<strong>{{ currentQuestion.options[currentQuestion.correctIndex] }}</strong>
        </p>
        <p class="example">
          <em>{{ currentQuestion.word.example }}</em><br>
          <span class="zh">{{ currentQuestion.word.example_translation }}</span>
        </p>
        <button class="next" @click="next">下一题 →</button>
      </div>
    </main>

    <p v-else-if="loading" class="loading">出题中…</p>

    <div v-else-if="errorMsg" class="error">
      <p>出错了：{{ errorMsg }}</p>
      <button @click="loadQuestion">重试</button>
    </div>

    <footer class="stats">
      <span>已答 {{ state.totalAnswered }}</span>
      <span>正确 {{ state.totalCorrect }}</span>
      <span>正确率 {{ accuracy }}%</span>
      <span>最高连击 {{ state.maxCombo }}</span>
      <span>错词 {{ state.wrongWords.length }}</span>
      <button class="reset" @click="reset">重置</button>
    </footer>
  </div>
</template>

<style scoped>
.game {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
}
.status-bar {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  background: #1a1a2e;
  color: #eee;
  border-radius: 10px;
  margin-bottom: 20px;
}
.status-bar .cell { display: flex; flex-direction: column; align-items: center; flex: 1; }
.status-bar .label { font-size: 11px; opacity: 0.7; }
.status-bar .value { font-size: 18px; font-weight: bold; margin-top: 2px; }

.word-card {
  text-align: center;
  padding: 40px 20px;
  background: #f5f5f5;
  border-radius: 12px;
  margin-bottom: 20px;
}
.word { font-size: 42px; font-weight: bold; color: #16213e; margin-bottom: 10px; letter-spacing: 1px; }
.phonetic { font-size: 16px; color: #666; margin-bottom: 6px; font-family: "Lucida Sans Unicode", Arial, sans-serif; }
.pos { font-size: 13px; color: #999; }

.options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 20px;
}
.option {
  padding: 18px 14px;
  font-size: 15px;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
  color: #111;
}
.option:hover:not(:disabled) {
  background: #f0f0f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.option.correct { background: #4caf50; color: white; border-color: #4caf50; }
.option.wrong { background: #f44336; color: white; border-color: #f44336; }
.option:disabled { cursor: default; }

.result {
  text-align: center;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #eee;
}
.success { color: #2e7d32; font-weight: bold; font-size: 18px; margin-top: 0; }
.failure { color: #c62828; font-weight: bold; font-size: 18px; margin-top: 0; }
.example { margin: 16px 0; color: #555; font-size: 14px; line-height: 1.6; }
.example .zh { color: #888; font-size: 13px; }
.next {
  padding: 10px 28px;
  background: #16213e;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  margin-top: 8px;
}
.next:hover { background: #1f3060; }

.loading, .error {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}
.error button {
  margin-top: 12px;
  padding: 8px 20px;
  background: #16213e;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  padding: 14px;
  background: #f5f5f5;
  border-radius: 10px;
  font-size: 13px;
  color: #666;
  align-items: center;
}
.reset {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
}
.reset:hover { background: #fff; }

@media (prefers-color-scheme: dark) {
  .word-card { background: #1c1c20; }
  .word { color: #e6e6e6; }
  .phonetic { color: #aaa; }
  .pos { color: #888; }
  .option { background: #161618; border-color: #2a2a2d; color: #e6e6e6; }
  .option:hover:not(:disabled) { background: #202024; }
  .result { background: #161618; border-color: #2a2a2d; }
  .example { color: #ccc; }
  .example .zh { color: #999; }
  .stats { background: #1c1c20; color: #aaa; }
  .reset { border-color: #444; color: #aaa; }
  .reset:hover { background: #202024; }
}
</style>
