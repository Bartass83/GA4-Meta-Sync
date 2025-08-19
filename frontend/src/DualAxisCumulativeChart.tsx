// src/DualAxisCumulativeChart.tsx
import * as React from 'react';
import Box from '@mui/material/Box';
import {
  ChartContainer,
  LinePlot,
  AreaPlot,
  ScatterPlot,
  ChartsXAxis,
  ChartsYAxis,
  ChartsLegend,
  ChartsTooltip,
} from '@mui/x-charts';
import { FormGroup, FormControlLabel, Checkbox } from '@mui/material';
import { useMetrics } from './useMetrics';

// Kolory osi
const LEFT_AXIS_COLOR = '#1976d2';
const RIGHT_AXIS_COLOR = '#594B3F';

// Kolory serii
const COLORS = {
  purchases: '#D9A980',
  total_users: '#1976d2',
  add_to_cart: '#80CBD9',
  purchase_revenue: '#C480D9', // prawa oś
  meta_spend: '#BAD980',       // prawa oś
} as const;

// Helper: HEX -> rgba(alpha)
const hexToRgba = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const METRICS = [
  { key: 'purchases',        label: 'Purchases',        axis: 'left',  color: COLORS.purchases },
  { key: 'total_users',      label: 'Total users',      axis: 'left',  color: COLORS.total_users },
  { key: 'add_to_cart',      label: 'Add to cart',      axis: 'left',  color: COLORS.add_to_cart },
  { key: 'purchase_revenue', label: 'Purchase revenue', axis: 'right', color: COLORS.purchase_revenue },
  { key: 'meta_spend',       label: 'Meta spend',       axis: 'right', color: COLORS.meta_spend },
] as const;

type MetricKey = typeof METRICS[number]['key'];

const fmtPLN = (v: number) =>
  new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(v ?? 0);

export default function DualAxisCumulativeChart({ days = 30 }: { days?: number }) {
  const { data = [], isLoading, error } = useMetrics(days);

  const [selected, setSelected] = React.useState<Record<MetricKey, boolean>>({
    purchases: false,
    total_users: true,
    add_to_cart: true,
    purchase_revenue: true,
    meta_spend: true,
  });

  if (error) return <div style={{ color: 'crimson' }}>Błąd: {(error as any).message}</div>;
  if (isLoading) return <div>Ładowanie…</div>;

  // Zbuduj dataset (narastająco po prawej osi)
  let cumRevenue = 0;
  let cumSpend = 0;

  const actionsByDate = new Map<string, string[]>();
  data.forEach((d) => {
    const acts =
      Array.isArray(d.meta_actions)
        ? (d.meta_actions as string[])
        : (typeof d.meta_actions === 'string' && d.meta_actions.length
            ? d.meta_actions.split('|').map(s => s.trim()).filter(Boolean)
            : []);
    actionsByDate.set(d.date, acts);
  });

  const dataset = data.map(d => {
    cumRevenue += Number(d.purchase_revenue ?? 0);
    cumSpend += Number(d.meta_spend ?? 0);
    return {
      x: new Date(d.date),
      purchases: Number(d.purchases ?? 0),
      total_users: Number(d.total_users ?? 0),
      add_to_cart: Number(d.add_to_cart ?? 0),
      purchase_revenue: cumRevenue,
      meta_spend: cumSpend,
    };
  });

  // pierwsza zaznaczona metryka – pod nią kładziemy kropki (żeby były w kadrze)
  const firstSelected =
    (Object.keys(selected).find(k => (selected as any)[k]) as MetricKey) || 'purchases';

  const dots = dataset
    .map((row, idx) => {
      const dateStr = data[idx]?.date as string;
      const acts = actionsByDate.get(dateStr) ?? [];
      return {
        x: row.x,
        y: (row as any)[firstSelected] as number,
        actions: acts,
        spendCum: row.meta_spend,
        revenueCum: row.purchase_revenue,
      };
    })
    .filter(p => p.actions.length > 0);

  // Serie lewej osi
  const leftLines = METRICS
    .filter(m => m.axis === 'left' && selected[m.key])
    .map(m => ({
      id: `line-${m.key}`,
      type: 'line',
      label: m.label,
      dataKey: m.key,
      yAxisId: 'left',
      color: m.color,
      showMark: false,
    })) as any[];

  // Serie prawej osi – linia + półprzezroczyste wypełnienie (0.3)
  const rightLines = METRICS
    .filter(m => m.axis === 'right' && selected[m.key])
    .map(m => ({
      id: `line-${m.key}`,
      type: 'line',
      label: m.label,
      dataKey: m.key,
      yAxisId: 'right',
      color: m.color,          // kolor obrysu linii
      showMark: false,
      area: true,              // wypełnienie włączone
      areaStyle: {
        fill: hexToRgba(m.color, 0.3), // wymuszone 30% krycie
      },
      valueFormatter: (v: number | null) => fmtPLN(Number(v ?? 0)),
    })) as any[];

  return (
    <Box
      sx={{
        width: '100%',
        overflow: 'hidden',
        // Fallback CSS: wymuś 30% opacity dla wszystkich obszarów area
        '& .MuiAreaElement-root': { fillOpacity: 0.3 },
        // Opcjonalnie precyzyjnie dla konkretnych serii:
        '& [data-series-id="line-purchase_revenue"].MuiAreaElement-root': { fillOpacity: 0.3 },
        '& [data-series-id="line-meta_spend"].MuiAreaElement-root': { fillOpacity: 0.3 },
      }}
    >
      {/* Checkboxy/legenda w kolorach osi/serii */}
      <FormGroup row sx={{ mb: 2, gap: 2 }}>
        {METRICS.map(m => (
          <FormControlLabel
            key={m.key}
            control={
              <Checkbox
                size="small"
                checked={!!selected[m.key]}
                onChange={(_, checked) => setSelected(s => ({ ...s, [m.key]: checked }))}
                sx={{
                  color: m.axis === 'left' ? LEFT_AXIS_COLOR : RIGHT_AXIS_COLOR,
                  '&.Mui-checked': {
                    color: m.color,
                  },
                }}
              />
            }
            label={
              <span
                style={{
                  color: m.axis === 'left' ? LEFT_AXIS_COLOR : RIGHT_AXIS_COLOR,
                  fontWeight: 500,
                }}
              >
                {m.label}{m.axis === 'right' ? ' (right Y)' : ''}
              </span>
            }
          />
        ))}
      </FormGroup>

      <ChartContainer
        height={460}
        dataset={dataset}
        xAxis={[{ scaleType: 'time', dataKey: 'x', label: 'Data' }]}
        yAxis={[
          { id: 'left',  position: 'left',  width: 70 },
          { id: 'right', position: 'right', width: 90 },
        ]}
        series={[
          ...leftLines,
          ...rightLines,
          {
            id: 'meta-actions',
            type: 'scatter',
            label: 'Meta actions',
            data: dots, // { x: Date, y: number }
            markerSize: 8,
            color: LEFT_AXIS_COLOR,
            valueFormatter: (_v: number | null, ctx: any) => {
              const d = dots[ctx?.dataIndex ?? 0];
              const acts = d?.actions?.length ? `• ${d.actions.join('\n• ')}` : '(brak)';
              const spend = d?.spendCum != null ? `\nSpend (cum.): ${fmtPLN(Number(d.spendCum))}` : '';
              const rev = d?.revenueCum != null ? `\nRevenue (cum.): ${fmtPLN(Number(d.revenueCum))}` : '';
              return `Meta actions:\n${acts}${spend}${rev}`;
            },
          } as any,
        ]}
      >
        <AreaPlot />
        <LinePlot />
        <ScatterPlot />

        <ChartsXAxis label="Data" labelStyle={{ fontWeight: 600 }} tickLabelStyle={{ fontSize: 11 }} />

        <ChartsYAxis
          axisId="left"
          label="Zdarzenia"
          labelStyle={{ fill: LEFT_AXIS_COLOR, fontWeight: 600 }}
          tickLabelStyle={{ fill: LEFT_AXIS_COLOR, fontSize: 11 }}
        />

        <ChartsYAxis
          axisId="right"
          label="PLN (narastająco)"
          labelStyle={{ fill: RIGHT_AXIS_COLOR, fontWeight: 600 }}
          tickLabelStyle={{ fill: RIGHT_AXIS_COLOR, fontSize: 11 }}
        />

        <ChartsLegend />
        <ChartsTooltip
          slotProps={{
            root: {
              sx: {
                maxWidth: 360,
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              },
            },
          } as any}
        />
      </ChartContainer>
    </Box>
  );
}
