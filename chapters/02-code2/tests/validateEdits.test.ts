// tests/validateEdits.test.ts
import { describe, it, expect } from 'vitest'
import { validateEdit, validateEdits, MAX_EDITS } from '../server/utils/validateEdits'

describe('validateEdit', () => {
  it('接受合法 delete edit', () => {
    expect(validateEdit({ word: 'foo', delete: true }, 0)).toBeNull()
  })

  it('接受合法 update edit', () => {
    expect(validateEdit({ word: 'foo', changes: { translation: 'bar', difficulty: 3 } }, 0)).toBeNull()
  })

  it('接受空 changes 对象', () => {
    expect(validateEdit({ word: 'foo', changes: {} }, 0)).toBeNull()
  })

  it('接受没有 changes 也没有 delete 的 edit', () => {
    expect(validateEdit({ word: 'foo' }, 0)).toBeNull()
  })

  it('拒绝非对象', () => {
    expect(validateEdit(null, 0)).toContain('不是对象')
    expect(validateEdit('foo', 0)).toContain('不是对象')
    expect(validateEdit(42, 0)).toContain('不是对象')
  })

  it('拒绝 word 缺失', () => {
    expect(validateEdit({ changes: {} }, 0)).toContain('word')
  })

  it('拒绝 word 为空字符串', () => {
    expect(validateEdit({ word: '' }, 0)).toContain('word')
  })

  it('拒绝 word 非字符串', () => {
    expect(validateEdit({ word: 42 }, 0)).toContain('word')
  })

  it('拒绝 delete 非 boolean', () => {
    expect(validateEdit({ word: 'foo', delete: 'yes' }, 0)).toContain('delete')
  })

  it('拒绝 changes 非对象', () => {
    expect(validateEdit({ word: 'foo', changes: 'bad' }, 0)).toContain('changes')
  })

  it('拒绝 difficulty 超出 1-5', () => {
    expect(validateEdit({ word: 'foo', changes: { difficulty: 0 } }, 0)).toContain('difficulty')
    expect(validateEdit({ word: 'foo', changes: { difficulty: 6 } }, 0)).toContain('difficulty')
    expect(validateEdit({ word: 'foo', changes: { difficulty: 3.5 } }, 0)).toContain('difficulty')
  })

  it('接受 difficulty 1-5 边界', () => {
    expect(validateEdit({ word: 'foo', changes: { difficulty: 1 } }, 0)).toBeNull()
    expect(validateEdit({ word: 'foo', changes: { difficulty: 5 } }, 0)).toBeNull()
  })

  it('拒绝 difficulty 非 number', () => {
    expect(validateEdit({ word: 'foo', changes: { difficulty: '3' } }, 0)).toContain('difficulty')
  })

  it('拒绝字符串字段类型错误', () => {
    expect(validateEdit({ word: 'foo', changes: { translation: 42 } }, 0)).toContain('translation')
    expect(validateEdit({ word: 'foo', changes: { phonetic: null } }, 0)).toContain('phonetic')
  })

  it('index 反映在错误信息中', () => {
    const err = validateEdit({ word: '' }, 7)
    expect(err).toContain('edits[7]')
  })
})

describe('validateEdits', () => {
  it('接受合法数组', () => {
    expect(validateEdits([])).toBeNull()
    expect(validateEdits([{ word: 'foo' }])).toBeNull()
  })

  it('拒绝非数组', () => {
    expect(validateEdits(null)).toContain('数组')
    expect(validateEdits('foo')).toContain('数组')
    expect(validateEdits({})).toContain('数组')
  })

  it('拒绝超过 MAX_EDITS', () => {
    const edits = Array.from({ length: MAX_EDITS + 1 }, (_, i) => ({ word: `w${i}` }))
    const err = validateEdits(edits)
    expect(err).toContain('最多')
    expect(err).toContain(String(MAX_EDITS))
  })

  it('接受正好 MAX_EDITS', () => {
    const edits = Array.from({ length: MAX_EDITS }, (_, i) => ({ word: `w${i}` }))
    expect(validateEdits(edits)).toBeNull()
  })

  it('返回第一条失败的错误', () => {
    const edits = [
      { word: 'foo' },
      { word: '' },  // 失败
      { word: 'bar' }
    ]
    const err = validateEdits(edits)
    expect(err).toContain('edits[1]')
  })
})
