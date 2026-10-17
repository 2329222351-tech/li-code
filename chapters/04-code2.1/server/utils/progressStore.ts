// server/utils/progressStore.ts
// 背诵进度的落盘入口。
// - 路径解析：CODE21_DATA_DIR（Electron 启动前注入）或 cwd/server/data
// - 读：文件缺失 / 损坏都退化成「空进度」，不炸服务
// - 写：先写 .tmp 再 rename，避免中断时留下半截 JSON

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type { ProgressFile } from '~~/shared/types'
import { emptyProgress, sanitizeProgress } from '~~/shared/progress'
import { createLogger } from './logger'

const log = createLogger('progress-store')

const FILE_NAME = 'progress.json'

function resolveDataPath(): string {
  const dir = process.env.CODE21_DATA_DIR || resolve(process.cwd(), 'server/data')
  return join(dir, FILE_NAME)
}

export function getProgressPath(): string {
  return resolveDataPath()
}

export function loadProgress(): ProgressFile {
  const path = resolveDataPath()
  if (!existsSync(path)) return emptyProgress()
  try {
    const text = readFileSync(path, 'utf-8')
    if (!text.trim()) return emptyProgress()
    return sanitizeProgress(JSON.parse(text))
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.error({ msg: '读 progress.json 失败，已回退为空进度', path, error: message })
    return emptyProgress()
  }
}

export function saveProgress(file: ProgressFile): void {
  const path = resolveDataPath()
  const tmp = `${path}.tmp`
  try {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(tmp, JSON.stringify(file, null, 2), 'utf-8')
    renameSync(tmp, path)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    log.error({ msg: '写 progress.json 失败', path, error: message })
    throw new Error('写入背诵进度失败')
  }
}
