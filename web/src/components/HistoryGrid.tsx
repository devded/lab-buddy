import { LineChart, TrendingDown, TrendingUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { History } from "@/types"
import { FlagBadge } from "./ResultCard"
import { TrendChart } from "./TrendChart"

/** Small multiples: one sparkline per test seen in 2+ reports. Tap → opens it in Compare. */
export function HistoryGrid({
  history,
  selected,
  onPick,
}: {
  history: History | null
  selected: string | null
  onPick: (test: string) => void
}) {
  const tests = history ? Object.keys(history) : []
  if (history && tests.length === 0) return null

  return (
    <Card className="gap-4 rounded-2xl p-4 shadow-sm md:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LineChart className="size-5 text-primary" /> Trends at a glance
        </h2>
        <p className="text-sm text-muted-foreground">
          Every test across all your reports. Green band = normal range printed on each report.
        </p>
      </div>
      {!history ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {tests.map((t) => {
            const rows = history[t]
            const first = rows.find((r) => r.value != null)
            const last = [...rows].reverse().find((r) => r.value != null) ?? rows[rows.length - 1]
            const diff = first && last?.value != null && first.value != null ? last.value - first.value : null
            const Icon = diff != null && diff < 0 ? TrendingDown : TrendingUp
            return (
              <button
                key={t}
                type="button"
                onClick={() => onPick(t)}
                className={cn(
                  "min-h-11 min-w-0 rounded-xl border bg-background p-3 text-left transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected === t && "border-primary ring-1 ring-primary",
                )}
              >
                <p className="truncate text-sm font-semibold">{t}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <p className="truncate text-lg font-bold">
                    {last.value_text ?? last.value ?? "—"}{" "}
                    <span className="text-xs font-normal text-muted-foreground">{last.unit}</span>
                  </p>
                  <FlagBadge flag={last.flag} className="shrink-0 px-1.5 text-[10px]" />
                </div>
                <TrendChart rows={rows} compact />
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {diff != null && (
                    <>
                      <Icon className="size-3.5 shrink-0" />
                      {diff > 0 ? "+" : ""}
                      {Number(diff.toFixed(2))} since {first?.report_date?.slice(0, 4)}
                    </>
                  )}
                </p>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}
