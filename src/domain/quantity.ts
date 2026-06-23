export type ParsedQuantity = { text: string; num: number | null; unit: string | null }

function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
}

export function parseQuantity(input: string): ParsedQuantity {
  const text = input.trim()
  const normalized = toHalfWidthDigits(text)
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(.*)$/)
  if (match) {
    const num = Number(match[1])
    const unit = match[2].trim() || null
    return { text, num, unit }
  }
  return { text, num: null, unit: text || null }
}
