import { cn } from "@/lib/utils"
import type { Flag } from "@/types"

/** Normal zone in the middle 50% of the bar; dot marks the value, clamped inside. */
export function RangeBar({
  value,
  low,
  high,
  flag,
}: {
  value: number | null
  low: number | null
  high: number | null
  flag: Flag
}) {
  if (value == null || high == null) return null
  const lo = low ?? 0 // "< x" ranges: treat the lower bound as 0
  const span = high - lo
  if (!(span > 0)) return null
  const min = lo - span / 2
  const max = high + span / 2
  const pct = (v: number) => ((v - min) / (max - min)) * 100
  const dot = Math.min(97, Math.max(3, pct(value)))
  const dotColor = flag === "high" ? "bg-high" : flag === "low" ? "bg-low" : "bg-normal"

  return (
    <div className="relative h-2 w-full rounded-full bg-slate-200" aria-hidden>
      <div
        className="absolute inset-y-0 rounded-full bg-normal/35"
        style={{ left: `${pct(lo)}%`, width: `${pct(high) - pct(lo)}%` }}
      />
      <div
        className={cn("absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white shadow", dotColor)}
        style={{ left: `${dot}%` }}
      />
    </div>
  )
}
