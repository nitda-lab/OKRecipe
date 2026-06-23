import type { SupabaseClient } from '@supabase/supabase-js'
import type { Recipe, NewRecipe, RecipeRepository } from './recipeRepository'

type DbRow = { id: string; title: string; body: string; created_at: string }
const toRecipe = (r: DbRow): Recipe => ({ id: r.id, title: r.title, body: r.body, createdAt: r.created_at })

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private sb: SupabaseClient) {}

  async list(userId: string): Promise<Recipe[]> {
    const { data, error } = await this.sb
      .from('recipes')
      .select('id, title, body, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as DbRow[]).map(toRecipe)
  }

  async create(userId: string, r: NewRecipe): Promise<Recipe> {
    const { data, error } = await this.sb
      .from('recipes')
      .insert({ user_id: userId, title: r.title.trim(), body: r.body })
      .select('id, title, body, created_at')
      .single()
    if (error) throw error
    return toRecipe(data as DbRow)
  }

  async get(userId: string, id: string): Promise<Recipe | null> {
    const { data, error } = await this.sb
      .from('recipes')
      .select('id, title, body, created_at')
      .eq('user_id', userId)
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ? toRecipe(data as DbRow) : null
  }

  async remove(userId: string, id: string): Promise<void> {
    const { error } = await this.sb.from('recipes').delete().eq('user_id', userId).eq('id', id)
    if (error) throw error
  }
}
