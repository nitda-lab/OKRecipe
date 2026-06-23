import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'

export interface InventoryRepository {
  list(userId: string): Promise<InventoryItem[]>
  add(userId: string, input: NewInventoryInput): Promise<InventoryItem>
  updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem>
  remove(userId: string, id: string): Promise<void>
}
