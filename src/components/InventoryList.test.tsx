import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InventoryList } from './InventoryList'
import type { InventoryItem } from '@/domain/inventory'

const items: InventoryItem[] = [
  {
    id: '1',
    userId: 'u',
    name: '卵',
    quantityText: '6個',
    quantityNum: 6,
    unitText: '個',
    expiresAt: null,
    source: 'manual',
    updatedAt: '2026-01-01',
  },
  {
    id: '2',
    userId: 'u',
    name: '牛乳',
    quantityText: '1本',
    quantityNum: 1,
    unitText: '本',
    expiresAt: null,
    source: 'manual',
    updatedAt: '2026-01-01',
  },
]

function noop() {}

describe('InventoryList', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('単体削除は確認OKで実行される', () => {
    const onRemove = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<InventoryList items={items} onUpdate={noop} onRemove={onRemove} onRemoveMany={noop} />)
    fireEvent.click(screen.getAllByLabelText('削除')[0])
    expect(window.confirm).toHaveBeenCalled()
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it('確認をキャンセルすると削除しない', () => {
    const onRemove = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<InventoryList items={items} onUpdate={noop} onRemove={onRemove} onRemoveMany={noop} />)
    fireEvent.click(screen.getAllByLabelText('削除')[0])
    expect(onRemove).not.toHaveBeenCalled()
  })

  it('複数選択して一括削除（確認OK）できる', () => {
    const onRemoveMany = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<InventoryList items={items} onUpdate={noop} onRemove={noop} onRemoveMany={onRemoveMany} />)
    fireEvent.click(screen.getByLabelText('卵を選択'))
    fireEvent.click(screen.getByLabelText('牛乳を選択'))
    fireEvent.click(screen.getByText(/選択した2件を削除/))
    expect(onRemoveMany).toHaveBeenCalledWith(['1', '2'])
  })

  it('一括削除も確認キャンセルで実行しない', () => {
    const onRemoveMany = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<InventoryList items={items} onUpdate={noop} onRemove={noop} onRemoveMany={onRemoveMany} />)
    fireEvent.click(screen.getByLabelText('卵を選択'))
    fireEvent.click(screen.getByText(/選択した1件を削除/))
    expect(onRemoveMany).not.toHaveBeenCalled()
  })

  it('全選択で全件が一括削除対象になる', () => {
    const onRemoveMany = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<InventoryList items={items} onUpdate={noop} onRemove={noop} onRemoveMany={onRemoveMany} />)
    fireEvent.click(screen.getByLabelText('全選択'))
    fireEvent.click(screen.getByText(/選択した2件を削除/))
    expect(onRemoveMany).toHaveBeenCalledWith(['1', '2'])
  })
})
