import { parseQuantity } from './quantity'

export type InventorySource = 'receipt' | 'fridge_photo' | 'manual' | 'chat'

export type InventoryItem = {
  id: string
  userId: string
  name: string
  quantityText: string
  quantityNum: number | null
  unitText: string | null
  expiresAt: string | null
  source: InventorySource
  updatedAt: string
}

export type NewInventoryInput = {
  name: string
  quantityText: string
  source?: InventorySource
  expiresAt?: string | null
}

export function buildInventoryItem(
  input: NewInventoryInput,
  ctx: { id: string; userId: string; now: string },
): InventoryItem {
  const q = parseQuantity(input.quantityText)
  return {
    id: ctx.id,
    userId: ctx.userId,
    name: input.name.trim(),
    quantityText: q.text,
    quantityNum: q.num,
    unitText: q.unit,
    expiresAt: input.expiresAt ?? null,
    source: input.source ?? 'manual',
    updatedAt: ctx.now,
  }
}

export function applyQuantityChange(
  item: InventoryItem,
  newQuantityText: string,
  now: string,
): InventoryItem {
  const q = parseQuantity(newQuantityText)
  return { ...item, quantityText: q.text, quantityNum: q.num, unitText: q.unit, updatedAt: now }
}
