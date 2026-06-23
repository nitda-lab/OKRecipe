export type ConversationSummary = { id: string; title: string; updatedAt: string }
export type StoredMessage = { role: 'user' | 'assistant'; content: string }

export interface ConversationRepository {
  list(userId: string): Promise<ConversationSummary[]>
  create(userId: string, title: string): Promise<string>
  getMessages(userId: string, conversationId: string): Promise<StoredMessage[]>
  appendMessages(userId: string, conversationId: string, messages: StoredMessage[]): Promise<void>
  remove(userId: string, conversationId: string): Promise<void>
}
