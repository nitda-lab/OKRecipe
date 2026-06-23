import { describe, it, expect } from 'vitest'
import { normalizeMarkdown } from './markdown'

describe('normalizeMarkdown', () => {
  it('adds a missing space after heading markers', () => {
    expect(normalizeMarkdown('##週の献立')).toBe('## 週の献立')
    expect(normalizeMarkdown('# 材料\n###手順')).toBe('# 材料\n### 手順')
  })

  it('removes a code fence that wraps the whole text', () => {
    expect(normalizeMarkdown('```markdown\n# 卵料理\n- 卵\n```')).toBe('# 卵料理\n- 卵')
  })

  it('removes a plain ``` wrapper', () => {
    expect(normalizeMarkdown('```\nhello\n```')).toBe('hello')
  })

  it('keeps already-valid markdown unchanged', () => {
    expect(normalizeMarkdown('# 見出し\n本文')).toBe('# 見出し\n本文')
  })

  it('does not strip an inner code block that is not wrapping everything', () => {
    const t = '説明\n```js\ncode\n```\n続き'
    expect(normalizeMarkdown(t)).toBe(t)
  })

  it('does not touch a # in the middle of a line', () => {
    expect(normalizeMarkdown('色は#FF0000です')).toBe('色は#FF0000です')
  })
})
