// server/utils/wordStore.ts
// 统一的词库读写入口。
// - 进程内缓存（避免每请求都读盘，12578 词 ~4.5MB）
// - save 后自动更新缓存
// - 读 / 写 / parse 都包 try/catch，文件损坏时不炸进程
// - 路径解析：Electron 模式下读 CODE2_DATA_DIR（main.cjs 在启动前 set 好）

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import type { Word } from '~~/shared/types'
import { createLogger } from './logger'

const log = createLogger('word-store')

/**
 * 解析数据文件路径：
 * - Electron 打包：CODE2_DATA_DIR/<file>.json（userData 或 exe 目录）
 * - 其它：cwd/server/data/<file>.json
 */
function resolveDataPath(file: string): string {
  const dir = process.env.CODE2_DATA_DIR || resolve(process.cwd(), 'server/data')
  return join(dir, file)
}

function ensureDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

let cache: Word[] | null = null

export function loadWords(): Word[] {
  if (cache) return cache
  const dataPath = resolveDataPath('words.json')
  try {
    const text = readFileSync(dataPath, 'utf-8')
    const parsed = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error('顶层不是数组')
    cache = parsed as Word[]
    return cache
  } catch (e: any) {
    log.error({ msg: '读 words.json 失败', path: dataPath, error: e?.message })
    throw new Error('词库文件损坏或不可读')
  }
}

export function saveWords(words: Word[]): void {
  const dataPath = resolveDataPath('words.json')
  try {
    ensureDir(dataPath)
    writeFileSync(dataPath, JSON.stringify(words, null, 2), 'utf-8')
    cache = words  // 同步缓存
  } catch (e: any) {
    log.error({ msg: '写 words.json 失败', path: dataPath, error: e?.message })
    throw new Error('写入词库失败')
  }
}

export function invalidateCache(): void {
  cache = null
}

export function getDataPath(): string {
  return resolveDataPath('words.json')
}
