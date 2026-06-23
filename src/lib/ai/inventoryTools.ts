import type { ToolCall, ToolSchema } from './types'
import type { InventoryRepository } from '@/repositories/inventoryRepository'

export type PendingAction =
  | { type: 'add'; name: string; quantityText: string }
  | { type: 'update'; id: string; quantityText: string }
  | { type: 'remove'; id: string }
  | { type: 'save_recipe'; title: string; body: string }

export const INVENTORY_TOOLS: ToolSchema[] = [
  {
    type: 'function',
    function: {
      name: 'list_inventory',
      description: '現在の在庫一覧を取得する。レシピ提案や在庫確認の前に必ず呼ぶ。',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_inventory',
      description: '在庫に食材を追加する提案を行う（実際の反映はユーザー確認後）。',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '食材名' },
          qty_text: { type: 'string', description: '個数(自然言語。例: 2個, 一人前分)' },
        },
        required: ['name', 'qty_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_inventory',
      description: '既存の在庫アイテムの個数を変更する提案。idはlist_inventoryの結果から取る。',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '在庫アイテムのid' },
          qty_text: { type: 'string', description: '新しい個数(自然言語)' },
        },
        required: ['id', 'qty_text'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_inventory',
      description: '在庫アイテムを削除する提案。idはlist_inventoryの結果から取る。',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: '在庫アイテムのid' } },
        required: ['id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_recipe',
      description:
        'レシピを保存する提案（実際の保存はユーザー確認後）。ユーザーが「このレシピ保存して」等と言ったときに使う。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'レシピ名' },
          body: { type: 'string', description: 'レシピ本文（Markdown。材料と手順）' },
        },
        required: ['title', 'body'],
      },
    },
  },
]

type Ctx = { repo: InventoryRepository; userId: string; pending: PendingAction[] }

export async function executeTool(call: ToolCall, ctx: Ctx): Promise<string> {
  const args = JSON.parse(call.function.arguments || '{}')
  switch (call.function.name) {
    case 'list_inventory': {
      const items = await ctx.repo.list(ctx.userId)
      return JSON.stringify(
        items.map((i) => ({ id: i.id, name: i.name, quantity: i.quantityText })),
      )
    }
    case 'add_inventory': {
      ctx.pending.push({ type: 'add', name: args.name, quantityText: args.qty_text })
      return `追加の提案を登録しました（ユーザー確認待ち）: ${args.name} ${args.qty_text}`
    }
    case 'update_inventory': {
      ctx.pending.push({ type: 'update', id: args.id, quantityText: args.qty_text })
      return `個数変更の提案を登録しました（ユーザー確認待ち）`
    }
    case 'remove_inventory': {
      ctx.pending.push({ type: 'remove', id: args.id })
      return `削除の提案を登録しました（ユーザー確認待ち）`
    }
    case 'save_recipe': {
      ctx.pending.push({ type: 'save_recipe', title: args.title, body: args.body })
      return `レシピ「${args.title}」の保存を提案しました（ユーザー確認待ち）`
    }
    default:
      throw new Error(`unknown tool: ${call.function.name}`)
  }
}
