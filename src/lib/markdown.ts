// 回答全体を囲むコードフェンス（```markdown ... ```）を剥がす。
// 内部の正当なコードブロックは保持する（全体を1つのフェンスが包む場合のみ除去）。
export function stripWrappingCodeFence(text: string): string {
  const t = text.trim()
  const m = t.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i)
  return m ? m[1] : text
}

// AIが出力しがちな崩れたMarkdownを描画前に補正する。
export function normalizeMarkdown(text: string): string {
  let t = stripWrappingCodeFence(text)
  // 行頭の見出し記号の直後にスペースが無い場合に補う（"##見出し" → "## 見出し"）
  t = t.replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
  return t
}
