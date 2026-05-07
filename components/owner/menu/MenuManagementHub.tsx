'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOwnerRestaurant } from '@/components/owner/owner-context'
import { PlanGateAuto } from '@/components/owner/PlanGate'
import { ErrorBanner, WarningBanner } from './Banners'
import { ItemsTab } from './ItemsTab'
import { CategoriesTab } from './CategoriesTab'
import { MenusTab } from './MenusTab'
import { UpsellsTab } from './UpsellsTab'
import { HappyHourTab } from './HappyHourTab'
import { apiGetJson } from '@/lib/menu/client-api'
import type {
  Category,
  MenuItemAdmin,
  MenuItemWithDiscount,
  MenuWithSchedules,
  UpsellSuggestion,
  HappyHourRuleWithItems,
} from './types'

type TabId = 'items' | 'categories' | 'menus' | 'upsells' | 'happyHour'

export function MenuManagementHub() {
  const { restaurantId, plan } = useOwnerRestaurant()
  const isPro = plan === 'pro' || plan === 'enterprise'

  const [tab, setTab] = useState<TabId>('items')
  const [items, setItems] = useState<MenuItemAdmin[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeByItemId, setActiveByItemId] = useState<Map<string, MenuItemWithDiscount>>(new Map())
  const [menus, setMenus] = useState<MenuWithSchedules[]>([])
  const [upsells, setUpsells] = useState<UpsellSuggestion[]>([])
  const [happyRules, setHappyRules] = useState<HappyHourRuleWithItems[]>([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const rid = encodeURIComponent(restaurantId)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [itemsData, catData, activeData] = await Promise.all([
        apiGetJson<MenuItemAdmin[]>(`/api/menu/items?restaurantId=${rid}`),
        apiGetJson<Category[]>(`/api/menu/categories?restaurantId=${rid}`),
        apiGetJson<MenuItemWithDiscount[]>(`/api/menu/active?restaurantId=${rid}`),
      ])

      const mapped = itemsData.map(row => ({
        ...row,
        price: typeof row.price === 'string' ? parseFloat(row.price) : Number(row.price),
      }))
      setItems(mapped)
      setCategories(catData)
      const am = new Map<string, MenuItemWithDiscount>()
      for (const a of activeData) {
        am.set(a.id, a)
      }
      setActiveByItemId(am)

      if (isPro) {
        const [menusData, upsData, hhData] = await Promise.all([
          apiGetJson<MenuWithSchedules[]>(`/api/menu/menus?restaurantId=${rid}`),
          apiGetJson<UpsellSuggestion[]>(`/api/menu/upsells?restaurantId=${rid}`),
          apiGetJson<HappyHourRuleWithItems[]>(`/api/menu/happy-hour?restaurantId=${rid}`),
        ])
        setMenus(menusData ?? [])
        setUpsells(upsData ?? [])
        setHappyRules(hhData ?? [])
      } else {
        setMenus([])
        setUpsells([])
        setHappyRules([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menu data')
    } finally {
      setLoading(false)
    }
  }, [rid, isPro])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const tabBtn = (id: TabId, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        tab === id
          ? 'bg-brand-800 text-white'
          : 'bg-brand-100 text-brand-700 hover:bg-brand-200'
      }`}
    >
      {label}
    </button>
  )

  const onTranslationWarning = useCallback((msg: string) => setWarning(msg), [])

  return (
    <div className="p-4 lg:p-6">
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {warning && <WarningBanner message={warning} onDismiss={() => setWarning(null)} />}

      <div className="mb-6 flex flex-wrap gap-2 border-b border-brand-200 pb-4">
        {tabBtn('items', 'Items')}
        {tabBtn('categories', 'Categories')}
        {isPro && tabBtn('menus', 'Menus')}
        {isPro && tabBtn('upsells', 'Upsells')}
        {isPro && tabBtn('happyHour', 'Happy Hour')}
      </div>

      {tab === 'items' && (
        <ItemsTab
          items={items}
          categories={categories}
          activeByItemId={activeByItemId}
          loading={loading}
          onRefresh={loadAll}
          onTranslationWarning={onTranslationWarning}
        />
      )}
      {tab === 'categories' && (
        <CategoriesTab
          categories={categories}
          items={items}
          loading={loading}
          onRefresh={loadAll}
        />
      )}
      {tab === 'menus' && isPro && (
        <PlanGateAuto requiredPlan="pro" featureName="Πολλαπλά μενού">
          <MenusTab menus={menus} items={items} loading={loading} onRefresh={loadAll} />
        </PlanGateAuto>
      )}
      {tab === 'upsells' && isPro && (
        <PlanGateAuto requiredPlan="pro" featureName="Upsells">
          <UpsellsTab items={items} upsells={upsells} loading={loading} onRefresh={loadAll} />
        </PlanGateAuto>
      )}
      {tab === 'happyHour' && isPro && (
        <PlanGateAuto requiredPlan="pro" featureName="Happy hour">
          <HappyHourTab
            rules={happyRules}
            items={items}
            loading={loading}
            onRefresh={loadAll}
            onTranslationWarning={onTranslationWarning}
          />
        </PlanGateAuto>
      )}
    </div>
  )
}
