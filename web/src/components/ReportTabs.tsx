import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { reportLabel } from "@/lib/api"
import type { Report } from "@/types"

export function ReportTabs({
  reports,
  selectedId,
  onSelect,
}: {
  reports: Report[]
  selectedId: number | null
  onSelect: (id: number) => void
}) {
  return (
    <Tabs value={selectedId == null ? "" : String(selectedId)} onValueChange={(v) => onSelect(Number(v))}>
      <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
        <TabsList className="w-max group-data-horizontal/tabs:h-11 rounded-xl bg-slate-200/60">
          {reports.map((r) => (
            <TabsTrigger key={r.id} value={String(r.id)} className="flex-none rounded-lg px-4 text-sm">
              {reportLabel(r)}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  )
}
