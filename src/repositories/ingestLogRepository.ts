import type { SupabaseClient } from '@supabase/supabase-js'

export class SupabaseIngestLogRepository {
  constructor(private sb: SupabaseClient) {}

  async record(userId: string, kind: 'receipt' | 'fridge', rawJson: string): Promise<void> {
    const { error } = await this.sb
      .from('ingest_logs')
      .insert({ user_id: userId, kind, ai_raw_json: rawJson, status: 'extracted' })
    if (error) throw error
  }
}
