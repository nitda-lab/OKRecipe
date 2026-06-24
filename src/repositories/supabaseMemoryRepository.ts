import type { SupabaseClient } from '@supabase/supabase-js'
import type { Memory, MemoryRepository } from './memoryRepository'

type DbRow = { id: string; text: string; created_at: string }
const toMemory = (r: DbRow): Memory => ({ id: r.id, text: r.text, createdAt: r.created_at })

export class SupabaseMemoryRepository implements MemoryRepository {
  constructor(private sb: SupabaseClient) {}

  async list(userId: string): Promise<Memory[]> {
    const { data, error } = await this.sb
      .from('memories')
      .select('id, text, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as DbRow[]).map(toMemory)
  }

  async create(userId: string, text: string): Promise<Memory> {
    const { data, error } = await this.sb
      .from('memories')
      .insert({ user_id: userId, text: text.trim() })
      .select('id, text, created_at')
      .single()
    if (error) throw error
    return toMemory(data as DbRow)
  }

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.sb.from('memories').delete().eq('user_id', userId).eq('id', id)
    if (error) throw error
  }
}
