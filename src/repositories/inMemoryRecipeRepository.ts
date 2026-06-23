import type { Recipe, NewRecipe, RecipeRepository } from './recipeRepository'

type Deps = { idFactory: () => string; clock: () => string }
type Row = Recipe & { userId: string }

export class InMemoryRecipeRepository implements RecipeRepository {
  private rows: Row[] = []
  constructor(private deps: Deps) {}

  async list(userId: string): Promise<Recipe[]> {
    return this.rows.filter((r) => r.userId === userId).map(({ userId: _u, ...r }) => r)
  }

  async create(userId: string, r: NewRecipe): Promise<Recipe> {
    const row: Row = {
      id: this.deps.idFactory(),
      userId,
      title: r.title.trim(),
      body: r.body,
      createdAt: this.deps.clock(),
    }
    this.rows.push(row)
    const { userId: _u, ...rec } = row
    return rec
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId)
    if (!row) return null
    const { userId: _u, ...rec } = row
    return rec
  }

  async remove(userId: string, id: string): Promise<void> {
    const idx = this.rows.findIndex((r) => r.id === id && r.userId === userId)
    if (idx === -1) throw new Error(`recipe not found: ${id}`)
    this.rows.splice(idx, 1)
  }
}
