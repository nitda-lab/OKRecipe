// 純粋関数: 長辺が max を超える場合のみ縦横比維持で縮小後の寸法を返す
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const scale = max / Math.max(w, h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

// ブラウザ専用: 画像を縮小し JPEG data URL を返す（送信ボディを小さくするため）
export async function downscaleDataUrl(file: File, max = 1568, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()
  return canvas.toDataURL('image/jpeg', quality)
}
