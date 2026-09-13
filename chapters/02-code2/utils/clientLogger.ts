// utils/clientLogger.ts
// 客户端轻量日志：console + 内存 buffer（最近 200 条）
// - 错误自动记录到 buffer，方便复现问题时报给作者
// - 也可手动调用 createClientLogger() 记录关键操作（save、load、TTS 切换等）
// - 服务端日志见 server/utils/logger.ts

import { ref } from 'vue'

export type ClientLogLevel = 'debug' | 'info' | 'warn' | 'error'

interface ClientLogEntry {
  ts: string
  level: ClientLogLevel
  source: string
  msg: string
  data?: Record<string, unknown>
}

const MAX_ENTRIES = 200
const buffer: ClientLogEntry[] = []
const errors = ref<ClientLogEntry[]>([])  // 错误单独暴露，方便 UI 展示

function push(level: ClientLogLevel, source: string, msg: string, data?: Record<string, unknown>) {
  const entry: ClientLogEntry = {
    ts: new Date().toISOString(),
    level,
    source,
    msg,
    data
  }
  buffer.push(entry)
  if (buffer.length > MAX_ENTRIES) buffer.shift()
  if (level === 'error') {
    errors.value.push(entry)
    if (errors.value.length > 50) errors.value.shift()
  }
  // 控制台
  const consoleMsg = `[${entry.ts}] [${level}] [${source}] ${msg}`
  if (level === 'error') console.error(consoleMsg, data ?? '')
  else if (level === 'warn') console.warn(consoleMsg, data ?? '')
  else if (level === 'debug') console.debug(consoleMsg, data ?? '')
  else console.log(consoleMsg, data ?? '')
}

export interface ClientLogger {
  debug: (msg: string, data?: Record<string, unknown>) => void
  info: (msg: string, data?: Record<string, unknown>) => void
  warn: (msg: string, data?: Record<string, unknown>) => void
  error: (msg: string, data?: Record<string, unknown>) => void
}

export function createClientLogger(source: string): ClientLogger {
  return {
    debug: (msg, data) => push('debug', source, msg, data),
    info:  (msg, data) => push('info',  source, msg, data),
    warn:  (msg, data) => push('warn',  source, msg, data),
    error: (msg, data) => push('error', source, msg, data),
  }
}

export function getRecentLogs(limit = 50): ClientLogEntry[] {
  return buffer.slice(-limit)
}

export function getRecentErrors() {
  return errors
}

export function clearErrors() {
  errors.value = []
}
