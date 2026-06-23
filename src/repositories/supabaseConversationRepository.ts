import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConversationRepository,
  ConversationSummary,
  StoredMessage,
} from './conversationRepository'

export class SupabaseConversationRepository implements ConversationRepository {
  constructor(private sb: SupabaseClient) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    const { data, error } = await this.sb
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data as Array<{ id: string; title: string; updated_at: string }>).map((r) => ({
      id: r.id,
      title: r.title,
      updatedAt: r.updated_at,
    }))
  }

  async create(userId: string, title: string): Promise<string> {
    const { data, error } = await this.sb
      .from('conversations')
      .insert({ user_id: userId, title })
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }

  async getMessages(userId: string, conversationId: string): Promise<StoredMessage[]> {
    const { data, error } = await this.sb
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as Array<{ role: 'user' | 'assistant'; content: string }>).map((r) => ({
      role: r.role,
      content: r.content,
    }))
  }

  async appendMessages(
    userId: string,
    conversationId: string,
    messages: StoredMessage[],
  ): Promise<void> {
    if (messages.length > 0) {
      const rows = messages.map((m) => ({
        conversation_id: conversationId,
        user_id: userId,
        role: m.role,
        content: m.content,
      }))
      const { error } = await this.sb.from('chat_messages').insert(rows)
      if (error) throw error
    }
    const { error: upErr } = await this.sb
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId)
      .eq('user_id', userId)
    if (upErr) throw upErr
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    const { error } = await this.sb
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)
    if (error) throw error
  }
}
