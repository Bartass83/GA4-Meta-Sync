import * as React from 'react'
import {
  ChartContainer, LinePlot, ScatterPlot,
  ChartsXAxis, ChartsYAxis, ChartsLegend, ChartsTooltip,
} from '@mui/x-charts'
import { useMetrics } from './useMetrics'
import { Box, FormGroup, FormControlLabel, Checkbox } from '@mui/material'

const METRICS = [
  { key: 'purchases',        label: 'Purchases',        axis: 'left'  as const },
  { key: 'total_users',      label: 'Total users',      axis: 'left'  as const },
  { key: 'add_to_cart',      label: 'Add to cart',      axis: 'left'  as const },
  { key: 'purchase_revenue', label: 'Purchase revenue', axis: 'left'  as const },
  { key: 'meta_spend',       label: 'Meta spend',       axis: 'right' as const },
]
type MetricKey = typeof METRICS[number]['key']

const fmtPLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v)

export default function Ga4MetaChart({ days = 30 }: { days?: number }) {
  const { data = [], isLoading, error } = useMetrics(days)
  const [selected, setSelected] = React.useState<Record<MetricKey, boolean>>({
    purchases: true, total_users: false, add_to_cart: false, purchase_revenue: false, meta_spend: false,
  })

  if (error) return <div style={{ color: 'crimson' }}>Błąd: {(error as any).message}</div>
  if (isLoading) return <div>Ładowanie…</div>

  // dataset TYLKO prymitywy (wymóg X-Charts)
  const dataset = data.map(d => ({
    x: new Date(d.date),
    purchases: Number(d.purchases ?? 0),
    total_users: Number(d.total_users ?? 0),
    add_to_cart: Number(d.add_to_cart ?? 0),
    purchase_revenue: Number(d.purchase_revenue ?? 0),
    meta_spend: Number(d.meta_spend ?? 0),
  }))

  // pierwsza zaznaczona metryka -> do niej „przyklejamy” kropki
  const firstSelected: MetricKey =
    (Object.keys(selected).find(k => (selected as any)[k]) as MetricKey) || 'purchases'

  // kropki (trzymamy actions/spend w data scattera)
  const dots = data
    .map(d => ({
      x: new Date(d.date),
      y: Number((d as any)[firstSelected] ?? 0),
      actions: Array.isArray(d.meta_actions) ? d.meta_actions : [],
      spend: d.meta_spend ?? null,
    }))
    .filter(p => p.actions.length > 0)

  const leftLines  = METRICS
    .filter(m => m.axis === 'left'  && selected[m.key])
    .map(m => ({ id: `line-${m.key}`, type: 'line', label: m.label, dataKey: m.key, yAxisKey: 'left' }) as any)

  const rightLines = METRICS
    .filter(m => m.axis === 'right' && selected[m.key])
    .map(m => ({
      id: `line-${m.key}`, type: 'line', label: m.label, dataKey: m.key, yAxisKey: 'right',
      valueFormatter: (v: number) => fmtPLN(Number(v || 0)),
    }) as any)

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      <FormGroup row sx={{ mb: 2 }}>
        {METRICS.map(m => (
          <FormControlLabel
            key={m.key}
            control={
              <Checkbox
                size="small"
                checked={!!selected[m.key]}
                onChange={(_, checked) => setSelected(s => ({ ...s, [m.key]: checked }))}
              />
            }
            label={m.label + (m.axis === 'right' ? ' (right Y)' : '')}
          />
        ))}
      </FormGroup>

      <ChartContainer
        height={440}
        dataset={dataset}
        xAxis={[{ scaleType: 'time', dataKey: 'x' }]}
        yAxis={[
          { id: 'left' },
          { id: 'right', position: 'right' },
        ]}
        series={[
          ...leftLines,
          ...rightLines,
          {
            id: 'meta',
            type: 'scatter',
            label: 'Meta actions',
            xKey: 'x',
            yKey: 'y',
            data: dots,
            markerSize: 8,
            // Tooltip dla kropek (działa w v8.9.2)
            valueFormatter: (_v: number, ctx: { dataIndex: number }) => {
              const d = dots[ctx.dataIndex]
              const acts = d?.actions?.length ? `• ${d.actions.join('\n• ')}` : '(brak)'
              const spend = d?.spend != null ? `\nSpend: ${fmtPLN(Number(d.spend))}` : ''
              return `Meta actions:\n${acts}${spend}`
            },
          } as any,
        ]}
      >
        <LinePlot />
        <ScatterPlot />
        <ChartsXAxis />
        <ChartsYAxis />
        <ChartsLegend />
        <ChartsTooltip
          trigger="item"
          slotProps={{
            root: {
              sx: {
                maxWidth: 320,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
                position: 'absolute',
                pointerEvents: 'none',
                zIndex: 9,
              },
            },
          } as any}
        />
      </ChartContainer>
    </Box>
  )
}
