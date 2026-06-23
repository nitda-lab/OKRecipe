export type Recipe = { id: string; title: string; body: string; createdAt: string }
export type NewRecipe = { title: string; body: string }

export interface RecipeRepository {
  list(userId: string): Promise<Recipe[]>
  create(userId: string, r: NewRecipe): Promise<Recipe>
  get(userId: string, id: string): Promise<Recipe | null>
  remove(userId: string, id: string): Promise<void>
}
