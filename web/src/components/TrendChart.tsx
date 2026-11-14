import { Area, CartesianGrid, ComposedChart, Line, Tooltip, XAxis, YAxis } from "recharts"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { reportLabel } from "@/lib/api"
import type { CompareRow, Flag } from "@/types"

const FLAG_COLOR: Record<Flag, string> = {
  high: "var(--high)",
  low: "var(--low)",
  normal: "var(--normal)",
  unknown: "var(--unknown)",
}

const config = { value: { label: "Value", color: "var(--foreground)" } } satisfies ChartConfig

type Point = {
  key: number
  date: string
  label: string
  value: number | null
  band: [number, number] | null
  row: CompareRow
}

function toPoints(rows: CompareRow[]): Point[] {
  return rows.map((r) => ({
    key: r.report_id,
    date: r.report_date ?? "",
    label: reportLabel(r),
    value: r.value,
    band: r.range_low != null && r.range_high != null ? [r.range_low, r.range_high] : null,
    row: r,
  }))
}

const shortDate = (d: string) => {
  const [y, m] = d.split("-")
  return m ? `${new Date(+y, +m - 1).toLocaleString("en", { month: "short" })} ’${y.slice(2)}` : d
}

// Status dot: flag color + 2px surface ring so it separates from the line and band.
function Dot(props: { cx?: number; cy?: number; payload?: Point; r?: number }) {
  const { cx, cy, payload, r = 5 } = props
  if (cx == null || cy == null || !payload || payload.value == null) return null
  return <circle cx={cx} cy={cy} r={r} fill={FLAG_COLOR[payload.row.flag]} stroke="var(--background)" strokeWidth={2} />
}

function TipContent({ active, payload }: { active?: boolean; payload?: readonly { payload: Point }[] }) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{p.label}</p>
      <p className="text-muted-foreground">{p.date}</p>
      <p className="mt-1">
        <span className="font-semibold">{p.row.value_text ?? p.value}</span> {p.row.unit}{" "}
        <span className="font-medium uppercase" style={{ color: FLAG_COLOR[p.row.flag] }}>
          · {p.row.flag}
        </span>
      </p>
      {p.row.range_text && <p className="text-muted-foreground">Normal there: {p.row.range_text}</p>}
    </div>
  )
}

/** Value over time; shaded band = normal range printed on each report (it can differ per lab). */
export function TrendChart({ rows, compact = false }: { rows: CompareRow[]; compact?: boolean }) {
  const data = toPoints(rows)
  // Fit the axis to the values; show nearby band edges, but clip wide bands (e.g. Vitamin D 30–100)
  // so they don't flatten the line.
  const vals = data.map((d) => d.value).filter((v): v is number => v != null)
  const lows = data.map((d) => d.band?.[0]).filter((v): v is number => v != null)
  const highs = data.map((d) => d.band?.[1]).filter((v): v is number => v != null)
  const vMin = Math.min(...vals)
  const vMax = Math.max(...vals)
  const min = Math.min(vMin, lows.length ? Math.max(Math.min(...lows), vMin * 0.7) : vMin)
  const max = Math.max(vMax, highs.length ? Math.min(Math.max(...highs), vMax * 1.3) : vMax)
  // Round the axis to clean steps (1, 2, 5 × 10^n) so ticks read 10/20/30, not 10.1/25.1/40.1.
  const raw = (max - min || 1) / 4
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const domain: [number, number] = [Math.max(0, Math.floor(min / step) * step), Math.ceil(max / step) * step]
  const ticks = Array.from({ length: Math.round((domain[1] - domain[0]) / step) + 1 }, (_, i) => +(domain[0] + i * step).toFixed(6))

  return (
    <ChartContainer config={config} className={compact ? "aspect-auto h-14 w-full" : "aspect-auto h-56 w-full md:h-64"}>
      <ComposedChart
        data={data}
        margin={compact ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 10, right: 12, bottom: 0, left: 0 }}
      >
        {!compact && <CartesianGrid vertical={false} strokeDasharray="3 3" />}
        <XAxis dataKey="date" hide={compact} tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={16} fontSize={12} />
        <YAxis
          domain={domain}
          ticks={ticks}
          allowDataOverflow
          hide={compact}
          width={40}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(v: number) => `${+v.toFixed(2)}`}
        />
        <Area dataKey="band" type="step" fill="var(--normal)" fillOpacity={0.12} stroke="none" isAnimationActive={false} activeDot={false} />
        {!compact && (
          <Tooltip content={(p) => <TipContent active={p.active} payload={p.payload as unknown as readonly { payload: Point }[]} />} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
        )}
        <Line
          dataKey="value"
          type="linear"
          stroke="var(--color-value)"
          strokeWidth={2}
          connectNulls
          isAnimationActive={!compact}
          dot={(p) => <Dot key={p.index} {...p} r={compact ? 3 : 5} />}
          activeDot={(p) => <Dot key={p.index} {...p} r={7} />}
        />
      </ComposedChart>
    </ChartContainer>
  )
}
