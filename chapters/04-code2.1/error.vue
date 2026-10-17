<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)

function goHome(): void {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="err-wrap">
    <div class="err card">
      <p class="code">{{ error?.statusCode || 500 }}</p>
      <h1>{{ isNotFound ? '这个页面不存在' : '出了点问题' }}</h1>
      <p class="msg">{{ error?.statusMessage || error?.message || '未知错误' }}</p>
      <button class="btn primary" @click="goHome">回首页</button>
    </div>
  </div>
</template>

<style scoped>
.err-wrap {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: var(--bg, #f7f8fa);
}
.err {
  max-width: 440px;
  width: 100%;
  padding: 40px 32px;
  text-align: center;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e4e6ee);
  border-radius: 14px;
}
.code {
  margin: 0;
  font-size: 13px;
  letter-spacing: 0.16em;
  color: var(--faint, #9aa1ae);
  font-variant-numeric: tabular-nums;
}
.err h1 {
  margin: 10px 0 12px;
  font-size: 21px;
  font-weight: 650;
  color: var(--text, #14161c);
}
.msg {
  margin: 0 0 24px;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--muted, #6b7280);
  word-break: break-word;
}
.btn {
  padding: 10px 22px;
  font-family: inherit;
  font-size: 14px;
  color: #fff;
  background: #1a1a2e;
  border: none;
  border-radius: 10px;
  cursor: pointer;
}
</style>
