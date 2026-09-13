<script setup lang="ts">
import type { NuxtError } from '#app'
// createClientLogger 由 Nuxt 从 utils/ 自动导入

const props = defineProps<{ error: NuxtError }>()

const isNotFound = computed(() => props.error?.statusCode === 404)
const title = computed(() => isNotFound.value ? '页面走丢了' : '出错了')
const subtitle = computed(() => isNotFound.value
  ? '你访问的页面不存在或被搬走了'
  : (props.error?.message || '服务器打了个喷嚏')
)

const clientLog = createClientLogger('error-page')

onMounted(() => {
  clientLog.error('页面错误', {
    statusCode: props.error?.statusCode,
    message: props.error?.message,
    url: typeof window !== 'undefined' ? window.location.href : null
  })
})

function handleHome() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <div class="error-page">
    <div class="card">
      <div class="code">{{ error?.statusCode ?? '?' }}</div>
      <h1>{{ title }}</h1>
      <p class="subtitle">{{ subtitle }}</p>
      <button class="home-btn" @click="handleHome">回首页</button>
    </div>
  </div>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #eee;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "PingFang SC", sans-serif;
}
.card {
  text-align: center;
  padding: 48px 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 480px;
  width: 90%;
}
.code {
  font-size: 96px;
  font-weight: 900;
  line-height: 1;
  background: linear-gradient(135deg, #4caf50 0%, #2196f3 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 16px;
}
h1 {
  font-size: 24px;
  margin: 0 0 12px;
  color: #fff;
}
.subtitle {
  font-size: 14px;
  color: #aaa;
  margin: 0 0 32px;
  line-height: 1.6;
}
.home-btn {
  background: #4caf50;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}
.home-btn:hover {
  background: #45a049;
  transform: translateY(-2px);
}
</style>
