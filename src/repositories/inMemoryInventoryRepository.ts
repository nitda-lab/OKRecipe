import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'
import { buildInventoryItem, applyQuantityChange } from '@/domain/inventory'
import type { InventoryRepository } from './inventoryRepository'

type Deps = { idFactory: () => string; clock: () => string }

export class InMemoryInventoryRepository implements InventoryRepository {
  private items: InventoryItem[] = []
  constructor(private deps: Deps) {}

  async list(userId: string): Promise<InventoryItem[]> {
    return this.items.filter((i) => i.userId === userId)
  }

  async add(userId: string, input: NewInventoryInput): Promise<InventoryItem> {
    const item = buildInventoryItem(input, {
      id: this.deps.idFactory(),
      userId,
      now: this.deps.clock(),
    })
    this.items.push(item)
    return item
  }

  async updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem> {
    const item = this.items.find((i) => i.id === id && i.userId === userId)
    if (!item) throw new Error(`inventory item not found: ${id}`)
    const updated = applyQuantityChange(item, quantityText, this.deps.clock())
    Object.assign(item, updated)
    return item
  }

  async remove(userId: string, id: string): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === id && i.userId === userId)
    if (idx === -1) throw new Error(`inventory item not found: ${id}`)
    this.items.splice(idx, 1)
  }
}
