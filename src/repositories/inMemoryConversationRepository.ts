import type {
  ConversationRepository,
  ConversationSummary,
  StoredMessage,
} from './conversationRepository'

type Deps = { idFactory: () => string; clock: () => string }
type Convo = { id: string; userId: string; title: string; updatedAt: string; messages: StoredMessage[] }

export class InMemoryConversationRepository implements ConversationRepository {
  private convos: Convo[] = []
  constructor(private deps: Deps) {}

  async list(userId: string): Promise<ConversationSummary[]> {
    return this.convos
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt }))
  }

  async create(userId: string, title: string): Promise<string> {
    const id = this.deps.idFactory()
    this.convos.push({ id, userId, title, updatedAt: this.deps.clock(), messages: [] })
    return id
  }

  async getMessages(userId: string, conversationId: string): Promise<StoredMessage[]> {
    const c = this.convos.find((c) => c.id === conversationId && c.userId === userId)
    return c ? c.messages.map((m) => ({ ...m })) : []
  }

  async appendMessages(
    userId: string,
    conversationId: string,
    messages: StoredMessage[],
  ): Promise<void> {
    const c = this.convos.find((c) => c.id === conversationId && c.userId === userId)
    if (!c) throw new Error(`conversation not found: ${conversationId}`)
    c.messages.push(...messages)
    c.updatedAt = this.deps.clock()
  }

  async remove(userId: string, conversationId: string): Promise<void> {
    const idx = this.convos.findIndex((c) => c.id === conversationId && c.userId === userId)
    if (idx === -1) throw new Error(`conversation not found: ${conversationId}`)
    this.convos.splice(idx, 1)
  }
}
