import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Flag, Result } from "@/types"
import { RangeBar } from "./RangeBar"

const FLAG: Record<Flag, { label: string; badge: string; border: string; tip: string }> = {
  high: { label: "HIGH", badge: "bg-high text-white", border: "border-l-high", tip: "Above the normal range printed on this report" },
  low: { label: "LOW", badge: "bg-low text-white", border: "border-l-low", tip: "Below the normal range printed on this report" },
  normal: { label: "NORMAL", badge: "bg-normal text-white", border: "border-l-normal", tip: "Within the normal range printed on this report" },
  unknown: { label: "UNKNOWN", badge: "bg-slate-200 text-slate-700", border: "border-l-unknown", tip: "No range to compare against on this report" },
}

export function FlagBadge({ flag, className }: { flag: Flag; className?: string }) {
  const f = FLAG[flag] ?? FLAG.unknown
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge className={cn("h-6 px-2.5 font-semibold tracking-wide", f.badge, className)}>{f.label}</Badge>
      </TooltipTrigger>
      <TooltipContent>{f.tip}</TooltipContent>
    </Tooltip>
  )
}

export function formatRange(r: { range_text: string | null; range_low?: number | null; range_high?: number | null; unit: string | null }) {
  if (r.range_text) return r.range_text
  if (r.range_low != null && r.range_high != null) return `${r.range_low}–${r.range_high} ${r.unit ?? ""}`.trim()
  return null
}

export function ResultCard({ result, sourceLanguage }: { result: Result; sourceLanguage: string | null }) {
  const f = FLAG[result.flag] ?? FLAG.unknown
  const range = formatRange(result)
  const value = result.value_text ?? (result.value != null ? String(result.value) : "—")
  return (
    <Card className={cn("gap-3 rounded-2xl border-l-4 p-4 shadow-sm ring-1 md:p-5", f.border)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg leading-tight font-semibold">{result.name_en}</h3>
          <p className="truncate text-sm text-muted-foreground">
            {[result.original_name, sourceLanguage].filter(Boolean).join(" · ")}
          </p>
        </div>
        <FlagBadge flag={result.flag} />
      </div>
      <p className="flex items-baseline gap-1.5">
        <span className="text-3xl font-bold tracking-tight">{value}</span>
        {result.unit && <span className="text-base text-muted-foreground">{result.unit}</span>}
      </p>
      <RangeBar value={result.value} low={result.range_low} high={result.range_high} flag={result.flag} />
      {range && <p className="text-sm text-muted-foreground">Normal on this report: {range}</p>}
      {result.explanation && <p className="text-base leading-snug text-slate-700 md:text-sm">{result.explanation}</p>}
    </Card>
  )
}
