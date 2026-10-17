<script setup lang="ts">
// 单条背诵卡片：题干 + 选项 + 揭晓态。
// 卡片本身不持有状态，全部由父级（useReciteSession）驱动，便于回放与测试。

import type { QuestionItem } from '~~/shared/types'

const props = defineProps<{
  question: QuestionItem
  revealed: boolean
  picked: number | null
  bookmarked: boolean
  index: number
  total: number
}>()

const emit = defineEmits<{
  pick: [index: number]
  toggleBookmark: []
}>()

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'] as const

function stateOf(i: number): 'idle' | 'correct' | 'wrong' | 'dimmed' {
  if (!props.revealed) return 'idle'
  if (i === props.question.answer) return 'correct'
  if (props.picked === i) return 'wrong'
  return 'dimmed'
}

const answerLetter = computed(() => LETTERS[props.question.answer] ?? '?')
const pickedLetter = computed(() => (props.picked === null ? null : LETTERS[props.picked] ?? '?'))
const isSelfCheck = computed(() => props.revealed && props.picked === null)
</script>

<template>
  <section class="recite-card card">
    <header class="meta">
      <span class="counter">
        第 <strong>{{ index }}</strong> 条 / 共 {{ total }} 条
      </span>
      <button
        class="star"
        :class="{ on: bookmarked }"
        :title="bookmarked ? '取消收藏' : '收藏这条'"
        :aria-pressed="bookmarked"
        @click="emit('toggleBookmark')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" :fill="bookmarked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8">
          <path d="M12 3.6l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9z" stroke-linejoin="round" />
        </svg>
        <span>{{ bookmarked ? '已收藏' : '收藏' }}</span>
      </button>
    </header>

    <h2 class="stem">{{ question.stem }}</h2>

    <ul class="options">
      <li v-for="(opt, i) in question.options" :key="i">
        <button
          class="option"
          :class="stateOf(i)"
          :disabled="revealed"
          @click="emit('pick', i)"
        >
          <span class="letter">{{ LETTERS[i] }}</span>
          <span class="text">{{ opt }}</span>
          <span v-if="revealed && i === question.answer" class="tag ok">正确答案</span>
          <span v-else-if="revealed && picked === i" class="tag bad">你的选择</span>
        </button>
      </li>
    </ul>

    <div v-if="revealed" class="verdict" :class="picked === null ? 'neutral' : picked === question.answer ? 'pass' : 'fail'">
      <template v-if="picked === null">
        <span class="dot" />
        <span>正确答案：<strong>{{ answerLetter }}．{{ question.options[question.answer] }}</strong></span>
        <span class="hint">看完在心里过一遍，再自评</span>
      </template>
      <template v-else-if="picked === question.answer">
        <span class="dot" />
        <span>答对了 —— {{ pickedLetter }}．{{ question.options[picked] }}</span>
      </template>
      <template v-else>
        <span class="dot" />
        <span>
          你选了 {{ pickedLetter }}，正确答案是
          <strong>{{ answerLetter }}．{{ question.options[question.answer] }}</strong>
        </span>
      </template>
    </div>

    <p v-if="isSelfCheck" class="selfcheck-hint">
      自评后自动进入下一条；也可以按 <kbd>1</kbd> 会了 · <kbd>2</kbd> 模糊 · <kbd>3</kbd> 不会
    </p>
  </section>
</template>

<style scoped>
.recite-card { padding: 26px 28px 24px; }

.meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.counter { font-size: 13px; color: var(--muted); }
.counter strong { color: var(--text); font-variant-numeric: tabular-nums; }

.star {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 11px;
  font-family: inherit;
  font-size: 12.5px;
  color: var(--muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.star:hover { color: var(--text); border-color: var(--border-strong); background: var(--surface-2); }
.star.on { color: #b7791f; border-color: #e8c98a; background: var(--warn-soft); }

.stem {
  margin: 0 0 22px;
  font-size: 20px;
  line-height: 1.72;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: var(--text);
  text-wrap: pretty;
}

.options { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }

.option {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 13px;
  padding: 14px 16px;
  font-family: inherit;
  font-size: 15px;
  line-height: 1.6;
  text-align: left;
  color: var(--text-soft);
  background: var(--surface);
  border: 1.5px solid var(--border);
  border-radius: 11px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.1s;
}
.option:hover:not(:disabled) {
  border-color: var(--border-strong);
  background: var(--surface-2);
}
.option:active:not(:disabled) { transform: scale(0.996); }
.option:disabled { cursor: default; }

.letter {
  flex: none;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-top: 1px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface-2);
  border-radius: 7px;
  transition: background 0.15s, color 0.15s;
}
.text { flex: 1; }

.tag {
  flex: none;
  align-self: center;
  font-size: 11.5px;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.option.correct {
  border-color: var(--ok);
  background: var(--ok-soft);
  color: var(--text);
}
.option.correct .letter { background: var(--ok); color: #fff; }
.option.correct .tag.ok { color: var(--ok); background: rgba(21, 128, 61, 0.1); }

.option.wrong {
  border-color: var(--bad);
  background: var(--bad-soft);
  color: var(--text);
}
.option.wrong .letter { background: var(--bad); color: #fff; }
.option.wrong .tag.bad { color: var(--bad); background: rgba(185, 28, 28, 0.1); }

.option.dimmed { opacity: 0.62; }

.verdict {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
  padding: 13px 16px;
  font-size: 14px;
  line-height: 1.6;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-soft);
}
.verdict.pass { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.verdict.fail { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
.verdict .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
  align-self: center;
}
.verdict .hint { color: var(--muted); font-size: 13px; }
.verdict strong { font-weight: 600; }

.selfcheck-hint {
  margin: 14px 0 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.9;
}

@media (max-width: 560px) {
  .recite-card { padding: 20px 16px; }
  .stem { font-size: 17.5px; }
  .option { padding: 12px 13px; font-size: 14.5px; }
  .tag { display: none; }
}
</style>
