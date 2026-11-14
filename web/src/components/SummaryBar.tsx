import { Stethoscope } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { isAbnormal } from "@/lib/api"
import type { Result } from "@/types"

export function SummaryBar({ results, onBrief }: { results: Result[]; onBrief: () => void }) {
  const abnormal = results.filter((r) => isAbnormal(r.flag)).length
  const normal = results.filter((r) => r.flag === "normal").length
  const unknown = results.length - abnormal - normal
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="flex flex-wrap items-center gap-2 text-base">
        <Badge className="h-6 bg-high px-2.5 text-sm text-white">{abnormal}</Badge>
        <span>need attention</span>
        <span className="text-muted-foreground">·</span>
        <Badge className="h-6 bg-normal px-2.5 text-sm text-white">{normal}</Badge>
        <span>normal</span>
        {unknown > 0 && <span className="text-sm text-muted-foreground">· {unknown} unclear</span>}
      </p>
      <Button className="hidden h-10 lg:inline-flex" onClick={onBrief}>
        <Stethoscope /> Doctor brief (Deutsch)
      </Button>
    </div>
  )
}
