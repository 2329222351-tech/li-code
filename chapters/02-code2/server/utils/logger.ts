// server/utils/logger.ts
// 结构化 JSON 日志
// - 文件输出: <logs>/server-YYYY-MM-DD.log
// - 控制台输出: dev 默认全打，prod 只打 warn/error
// - 等级: debug < info < warn < error
// - 通过环境变量 LOG_LEVEL 调（debug | info | warn | error，默认 info）
// - Electron 模式下读 CODE2_DATA_DIR（main.cjs 在启动前 set 好）

import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

type Level = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 }
const ACTIVE_LEVEL: Level = ((process.env.LOG_LEVEL as Level) || 'info') in LEVEL_RANK
  ? (process.env.LOG_LEVEL as Level)
  : 'info'

function resolveLogDir(): string {
  const base = process.env.CODE2_DATA_DIR || resolve(process.cwd(), 'server')
  return join(base, 'logs')
}

const LOG_DIR = resolveLogDir()
try { mkdirSync(LOG_DIR, { recursive: true }) } catch { /* ignore */ }

const IS_PROD = process.env.NODE_ENV === 'production'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currentLogFile() {
  return join(LOG_DIR, `server-${today()}.log`)
}

function normalizeData(msg: string | Record<string, unknown>): Record<string, unknown> {
  return typeof msg === 'string' ? { msg } : msg
}

function emit(level: Level, source: string, data: string | Record<string, unknown>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[ACTIVE_LEVEL]) return
  const entry = {
    ts: new Date().toISOString(),
    level,
    source,
    ...normalizeData(data)
  }
  const line = JSON.stringify(entry)

  // 控制台
  if (level === 'error' || level === 'warn') {
    console.error(line)
  } else if (!IS_PROD) {
    console.log(line)
  }

  // 文件
  try {
    appendFileSync(currentLogFile(), line + '\n', 'utf-8')
  } catch {
    // 写日志失败绝不影响主流程
  }
}

export interface Logger {
  debug: (data: string | Record<string, unknown>) => void
  info: (data: string | Record<string, unknown>) => void
  warn: (data: string | Record<string, unknown>) => void
  error: (data: string | Record<string, unknown>) => void
}

export function createLogger(source: string): Logger {
  return {
    debug: (data) => emit('debug', source, data),
    info:  (data) => emit('info',  source, data),
    warn:  (data) => emit('warn',  source, data),
    error: (data) => emit('error', source, data)
  }
}
