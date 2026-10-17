// eslint.config.mjs
// ESLint 9 flat config，沿用 code2 的保守策略（不引 prettier，避免与 indent/quote 打架）。
//
// 用法：
//   pnpm lint        # 检查
//   pnpm lint:fix    # 自动修复

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
  // Vue
  ref: 'readonly',
  shallowRef: 'readonly',
  reactive: 'readonly',
  computed: 'readonly',
  watch: 'readonly',
  watchEffect: 'readonly',
  onMounted: 'readonly',
  onBeforeMount: 'readonly',
  onBeforeUnmount: 'readonly',
  onUnmounted: 'readonly',
  nextTick: 'readonly',
  toRef: 'readonly',
  toRefs: 'readonly',
  unref: 'readonly',
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
  definePageMeta: 'readonly',
  $fetch: 'readonly',
  useHead: 'readonly',
  useSeoMeta: 'readonly',
  // 项目自定义 composable（Nuxt 自动导入，eslint 需要显式声明）
  useBank: 'readonly',
  useProgress: 'readonly',
  useReciteSession: 'readonly',
}

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  localStorage: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  requestAnimationFrame: 'readonly',
  HTMLElement: 'readonly',
  KeyboardEvent: 'readonly',
  confirm: 'readonly',
}

export default [
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      '.nitro/**',
      'dist/**',
      'dist-v3/**',
      'release/**',
      'node_modules/**',
      'server/logs/**',
      '**/*.min.js',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    files: ['server/**', 'shared/**', 'tests/**', '*.config.*'],
    languageOptions: { globals: nuxtGlobals },
  },

  {
    files: ['**/*.vue', 'app/**', 'components/**', 'composables/**', 'error.vue'],
    languageOptions: { globals: { ...nuxtGlobals, ...browserGlobals } },
  },

  // 兜底：所有文件至少给 nuxt globals
  {
    languageOptions: { globals: nuxtGlobals },
  },

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
      indent: 'off',
      quotes: 'off',
      semi: 'off',
    },
  },

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
      'vue/no-unused-vars': 'off',
      'vue/order-in-components': 'off',
      'vue/require-default-prop': 'off',
    },
  },

  {
    files: ['**/*.test.ts', 'tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
