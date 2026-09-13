// eslint.config.mjs
// ESLint 9 flat config，手写。覆盖：
//   - JS/TS（typescript-eslint）
//   - Vue 3 SFC（vue-eslint-parser + eslint-plugin-vue）
//
// 用法：
//   pnpm lint        # 检查
//   pnpm lint:fix    # 自动修复
//
// 规则策略：保守；不引 prettier（与 ESLint 的 indent/quote 容易打架）。
// globals 列出 Nuxt / 浏览器 / 项目 composable 的 auto-import，避免误报 no-undef。

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'

const nuxtGlobals = {
  // Node
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
  // CJS (electron/*.cjs 用 require)
  require: 'readonly',
  module: 'readonly',
  exports: 'writable',
  __dirname: 'readonly',
  __filename: 'readonly',
  // Nitro / h3
  defineEventHandler: 'readonly',
  defineNitroPlugin: 'readonly',
  getQuery: 'readonly',
  getRouterParam: 'readonly',
  readBody: 'readonly',
  createError: 'readonly',
  sendError: 'readonly',
  setResponseStatus: 'readonly',
  setHeader: 'readonly',
  getHeader: 'readonly',
  getCookie: 'readonly',
  setCookie: 'readonly',
  useStorage: 'readonly',
  // Vue
  ref: 'readonly',
  shallowRef: 'readonly',
  reactive: 'readonly',
  computed: 'readonly',
  watch: 'readonly',
  watchEffect: 'readonly',
  watchPostEffect: 'readonly',
  onMounted: 'readonly',
  onBeforeMount: 'readonly',
  onBeforeUnmount: 'readonly',
  onUnmounted: 'readonly',
  onActivated: 'readonly',
  onDeactivated: 'readonly',
  onScopeDispose: 'readonly',
  onErrorCaptured: 'readonly',
  nextTick: 'readonly',
  toRef: 'readonly',
  toRefs: 'readonly',
  unref: 'readonly',
  inject: 'readonly',
  provide: 'readonly',
  // Nuxt
  useRuntimeConfig: 'readonly',
  useFetch: 'readonly',
  useAsyncData: 'readonly',
  useState: 'readonly',
  useRoute: 'readonly',
  useRouter: 'readonly',
  useNuxtApp: 'readonly',
  navigateTo: 'readonly',
  clearError: 'readonly',
  showError: 'readonly',
  defineNuxtConfig: 'readonly',
  defineNuxtPlugin: 'readonly',
  defineNuxtRouteMiddleware: 'readonly',
  definePageMeta: 'readonly',
  defineNuxtComponent: 'readonly',
  $fetch: 'readonly',
  useHead: 'readonly',
  useSeoMeta: 'readonly',
  useCookie: 'readonly',
  useRequestHeaders: 'readonly',
  useRequestEvent: 'readonly',
  useRequestURL: 'readonly',
  // 项目自定义 composable
  useSpeech: 'readonly',
  useSpeechSettings: 'readonly',
  useVirtualList: 'readonly',
  createClientLogger: 'readonly',
}

const browserGlobals = {
  // 浏览器
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  sessionStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  Event: 'readonly',
  KeyboardEvent: 'readonly',
  MouseEvent: 'readonly',
  HTMLElement: 'readonly',
  HTMLInputElement: 'readonly',
  HTMLSelectElement: 'readonly',
  Element: 'readonly',
  ComponentPublicInstance: 'readonly',
  SpeechSynthesis: 'readonly',
  SpeechSynthesisVoice: 'readonly',
  SpeechSynthesisUtterance: 'readonly',
  confirm: 'readonly',
  alert: 'readonly',
  location: 'readonly',
}

export default [
  // 全局忽略
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      '.nitro/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      'node_modules/**',
      'server/logs/**',
      '.trash/**',
      '**/*.min.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  // Node + Nitro 服务端
  {
    files: ['server/**', '*.config.*', 'scripts/**'],
    languageOptions: { globals: nuxtGlobals },
  },

  // 客户端 / Vue
  {
    files: ['**/*.vue', 'app/**', 'components/**', 'composables/**', 'error.vue'],
    languageOptions: { globals: { ...nuxtGlobals, ...browserGlobals } },
  },

  // 兜底：所有文件至少给 nuxt globals（避免漏配）
  {
    languageOptions: { globals: nuxtGlobals },
  },

  // 通用规则微调
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      'no-unused-vars': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // Vue 模板宽松（Nuxt 3 多根 + 自定义 SFC 风格）
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/no-unused-vars': 'off',  // 交给 typescript-eslint
    },
  },

  // 测试文件宽松
  {
    files: ['**/*.test.ts', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
