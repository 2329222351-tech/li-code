// server/utils/validateEdits.ts
// 校验 words/save.post.ts 的 edits payload。
// 抽出来是为了能单独单测（不必启 Nitro）。

export interface WordChanges {
  translation?: string
  phonetic?: string
  pos?: string
  difficulty?: number
  example?: string
  example_translation?: string
}

export interface SaveEdit {
  word: string
  changes?: WordChanges
  delete?: boolean
}

export interface SaveRequest {
  edits: SaveEdit[]
}

export const MAX_EDITS = 5000
export const VALID_DIFFICULTY: ReadonlyArray<number> = [1, 2, 3, 4, 5]

/**
 * 校验单条 edit，返回错误信息字符串；通过则返回 null。
 */
export function validateEdit(edit: unknown, index: number): string | null {
  if (!edit || typeof edit !== 'object') {
    return `edits[${index}] 不是对象`
  }
  const e = edit as Record<string, unknown>
  if (typeof e.word !== 'string' || !e.word) {
    return `edits[${index}].word 缺失或非字符串`
  }
  if (e.delete !== undefined && typeof e.delete !== 'boolean') {
    return `edits[${index}].delete 必须是 boolean`
  }
  if (e.changes !== undefined) {
    if (typeof e.changes !== 'object' || e.changes === null) {
      return `edits[${index}].changes 必须是对象`
    }
    const c = e.changes as Record<string, unknown>
    if (c.difficulty !== undefined) {
      if (typeof c.difficulty !== 'number' || !VALID_DIFFICULTY.includes(c.difficulty)) {
        return `edits[${index}].changes.difficulty 必须是 1-5`
      }
    }
    for (const k of ['translation', 'phonetic', 'pos', 'example', 'example_translation'] as const) {
      if (c[k] !== undefined && typeof c[k] !== 'string') {
        return `edits[${index}].changes.${k} 必须是字符串`
      }
    }
  }
  return null
}

/**
 * 校验整批 edits。任何一条失败立即返回错误。返回错误信息或 null。
 */
export function validateEdits(edits: unknown): string | null {
  if (!Array.isArray(edits)) {
    return 'edits 必须是数组'
  }
  if (edits.length > MAX_EDITS) {
    return `单次最多 ${MAX_EDITS} 条编辑`
  }
  for (let i = 0; i < edits.length; i++) {
    const err = validateEdit(edits[i], i)
    if (err) return err
  }
  return null
}
