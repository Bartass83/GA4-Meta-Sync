import { useQuery } from '@tanstack/react-query'

export type Row = {
  date: string
  total_users: number
  add_to_cart: number
  purchases: number
  purchase_revenue?: number | null
  meta_spend?: number | null
  meta_actions?: string[] | string | null
}

export function useMetrics(days = 30) {
  return useQuery({
    queryKey: ['metrics', days],
    queryFn: async (): Promise<Row[]> => {
      const r = await fetch(`/api/metrics?days=${days}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()

      // normalizacja na wszelki wypadek
      const rows: Row[] = (Array.isArray(data) ? data : data.data).map((d: any) => {
        const raw = d?.meta_actions
        const actions: string[] = Array.isArray(raw)
          ? raw
          : (typeof raw === 'string'
              ? raw.split(/\s*\|\s*|,\s*/).map((s) => s.trim()).filter(Boolean)
              : [])
        const spend =
          d?.meta_spend === null || d?.meta_spend === undefined
            ? 0
            : Number(d.meta_spend)

        return {
          date: String(d.date),
          total_users: Number(d.total_users ?? 0),
          add_to_cart: Number(d.add_to_cart ?? 0),
          purchases: Number(d.purchases ?? 0),
          purchase_revenue: Number(d.purchase_revenue ?? 0),
          meta_spend: spend,
          meta_actions: actions,
        }
      })

      return rows.sort((a, b) => a.date.localeCompare(b.date))
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  })
}
