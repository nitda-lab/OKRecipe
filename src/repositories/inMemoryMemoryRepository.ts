import type { Memory, MemoryRepository } from './memoryRepository'

type Deps = { idFactory: () => string; clock: () => string }
type Row = Memory & { userId: string }

export class InMemoryMemoryRepository implements MemoryRepository {
  private rows: Row[] = []
  constructor(private deps: Deps) {}

  async list(userId: string): Promise<Memory[]> {
    return this.rows.filter((r) => r.userId === userId).map(({ userId: _u, ...m }) => m)
  }

  async create(userId: string, text: string): Promise<Memory> {
    const row: Row = { id: this.deps.idFactory(), userId, text: text.trim(), createdAt: this.deps.clock() }
    this.rows.push(row)
    const { userId: _u, ...m } = row
    return m
  }

  async remove(userId: string, id: string): Promise<void> {
    const idx = this.rows.findIndex((r) => r.id === id && r.userId === userId)
    if (idx === -1) throw new Error(`memory not found: ${id}`)
    this.rows.splice(idx, 1)
  }
}
