import type { SupabaseClient } from '@supabase/supabase-js'
import type { InventoryItem, NewInventoryInput } from '@/domain/inventory'
import { parseQuantity } from '@/domain/quantity'
import type { InventoryRepository } from './inventoryRepository'

type Row = {
  id: string
  user_id: string
  name: string
  quantity_text: string
  quantity_num: number | null
  unit_text: string | null
  expires_at: string | null
  source: InventoryItem['source']
  updated_at: string
}

function toItem(r: Row): InventoryItem {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    quantityText: r.quantity_text,
    quantityNum: r.quantity_num,
    unitText: r.unit_text,
    expiresAt: r.expires_at,
    source: r.source,
    updatedAt: r.updated_at,
  }
}

export class SupabaseInventoryRepository implements InventoryRepository {
  constructor(private sb: SupabaseClient) {}

  async list(userId: string): Promise<InventoryItem[]> {
    const { data, error } = await this.sb
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as Row[]).map(toItem)
  }

  async add(userId: string, input: NewInventoryInput): Promise<InventoryItem> {
    const q = parseQuantity(input.quantityText)
    const { data, error } = await this.sb
      .from('inventory_items')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        quantity_text: q.text,
        quantity_num: q.num,
        unit_text: q.unit,
        source: input.source ?? 'manual',
        expires_at: input.expiresAt ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return toItem(data as Row)
  }

  async updateQuantity(userId: string, id: string, quantityText: string): Promise<InventoryItem> {
    const q = parseQuantity(quantityText)
    const { data, error } = await this.sb
      .from('inventory_items')
      .update({
        quantity_text: q.text,
        quantity_num: q.num,
        unit_text: q.unit,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error) throw error
    return toItem(data as Row)
  }

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.sb
      .from('inventory_items')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
    if (error) throw error
  }
}
