export type Memory = { id: string; text: string; createdAt: string }

export interface MemoryRepository {
  list(userId: string): Promise<Memory[]>
  create(userId: string, text: string): Promise<Memory>
  remove(userId: string, id: string): Promise<void>
}
