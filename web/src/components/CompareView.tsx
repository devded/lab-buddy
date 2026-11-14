import { useEffect, useState } from "react"
import { Activity, AlertCircle, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { api, isAbnormal, reportLabel } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { CompareRow } from "@/types"
import { FlagBadge } from "./ResultCard"
import { TrendChart } from "./TrendChart"

const VISIBLE = 4

export function CompareView({
  tests,
  refreshKey,
  test,
  onTestChange,
}: {
  tests: string[]
  refreshKey: number
  test: string | null
  onTestChange: (t: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [rows, setRows] = useState<CompareRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = test && tests.includes(test) ? test : (tests[0] ?? null)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    setRows(null)
    setError(null)
    api
      .compare(active)
      .then((r) => !cancelled && setRows(r))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [active, refreshKey])

  return (
    <Card className="gap-4 rounded-2xl p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Activity className="size-5 text-primary" /> Compare across reports
        </h2>
        {tests.length > 0 && (
          <Select value={active ?? ""} onValueChange={onTestChange}>
            <SelectTrigger
              className="w-full min-w-40 text-base data-[size=default]:h-11 sm:w-auto md:text-sm"
              aria-label="Test to compare"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {tests.map((t) => (
                <SelectItem key={t} value={t} className="min-h-11 text-base md:min-h-9 md:text-sm">
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {tests.length === 0 ? (
        <p className="text-base text-muted-foreground md:text-sm">
          Add a second report (from another country or language) to see how the same test changed over time.
        </p>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : !rows ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : (
        <>
        {rows.filter((r) => r.value != null).length >= 2 && <TrendChart rows={rows} />}
        <ul className="space-y-2">
          {rows.map((row, i) => {
            if (!showAll && i < rows.length - VISIBLE) return null
            const prev = rows[i - 1]
            const diff = prev && prev.value != null && row.value != null ? row.value - prev.value : null
            const worsened = !!prev && !isAbnormal(prev.flag) && isAbnormal(row.flag)
            const Icon = diff != null && diff < 0 ? TrendingDown : TrendingUp
            return (
              <li
                key={row.report_id}
                className={cn(
                  "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-xl border bg-background p-3 md:grid-cols-[1fr_auto_auto_10rem]",
                  worsened && "border-high/40 bg-high/5",
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-base font-medium">{reportLabel(row)}</p>
                  <p className="text-sm text-muted-foreground">
                    {row.report_date ?? "date unknown"}
                    {row.range_text && ` · normal ${row.range_text}`}
                  </p>
                </div>
                <p className="text-right text-xl font-bold whitespace-nowrap">
                  {row.value_text ?? row.value ?? "—"}{" "}
                  <span className="text-sm font-normal text-muted-foreground">{row.unit}</span>
                </p>
                <FlagBadge flag={row.flag} className="justify-self-start md:justify-self-end" />
                <p
                  className={cn(
                    "flex items-center justify-end gap-1 text-sm",
                    worsened ? "font-semibold text-high" : "text-muted-foreground",
                  )}
                >
                  {diff != null ? (
                    <>
                      <Icon className="size-4" />
                      {diff > 0 ? "+" : ""}
                      {Number(diff.toFixed(2))} {row.unit} vs before
                    </>
                  ) : (
                    i === 0 && "First result"
                  )}
                </p>
              </li>
            )
          })}
        </ul>
        {rows.length > VISIBLE && (
          <Button variant="ghost" className="h-11 w-full md:h-9" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show latest only" : `Show all ${rows.length} reports`}
          </Button>
        )}
        </>
      )}
    </Card>
  )
}
