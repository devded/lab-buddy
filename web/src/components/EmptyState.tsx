import { FlaskConical, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function EmptyState({ busy, onSample }: { busy: boolean; onSample: () => void }) {
  return (
    <Card className="items-center gap-3 rounded-2xl p-6 text-center shadow-sm md:p-8">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <FlaskConical className="size-7" />
      </div>
      <h2 className="text-lg font-semibold">Upload your first lab report</h2>
      <p className="max-w-sm text-base text-muted-foreground md:text-sm">
        We'll explain every value in plain language, flag what's outside the range printed on your report, and
        write a short brief for your doctor.
      </p>
      <Button size="lg" className="h-12 w-full md:w-auto" disabled={busy} onClick={onSample}>
        <Sparkles /> Try a sample report
      </Button>
    </Card>
  )
}
