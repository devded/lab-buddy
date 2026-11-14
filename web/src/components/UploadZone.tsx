import { useEffect, useRef, useState } from "react"
import { AlertCircle, RotateCcw, Upload } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

const MESSAGES = ["Reading your report…", "Translating test names…", "Checking normal ranges…"]

interface Props {
  busy: boolean
  error: string | null
  onFile: (file: File) => void
  onSample: (n: 1 | 2) => void
  onRetry: () => void
  showSamples: boolean
}

export function UploadZone({ busy, error, onFile, onSample, onRetry, showSamples }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [msg, setMsg] = useState(0)
  const [progress, setProgress] = useState(0)

  // Rotating messages + a fake progress that eases toward 92% (Gemini gives no real progress).
  useEffect(() => {
    if (!busy) return
    setMsg(0)
    setProgress(5)
    const m = setInterval(() => setMsg((i) => (i + 1) % MESSAGES.length), 1500)
    const p = setInterval(() => setProgress((v) => v + (92 - v) * 0.06), 300)
    return () => {
      clearInterval(m)
      clearInterval(p)
    }
  }, [busy])

  const pick = (files: FileList | null) => {
    const f = files?.[0]
    if (f) onFile(f)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-3">
      <Card
        role="button"
        tabIndex={0}
        aria-disabled={busy}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          if (!busy) pick(e.dataTransfer.files)
        }}
        className={cn(
          "cursor-pointer gap-3 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-4 shadow-sm ring-0 transition-colors hover:border-primary/60 hover:bg-primary/[0.06] md:p-5",
          drag && "border-primary bg-primary/10",
          busy && "cursor-wait",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => pick(e.target.files)}
        />
        {busy ? (
          <div className="space-y-3 py-2" aria-live="polite">
            <p className="text-base font-semibold">{MESSAGES[msg]}</p>
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground">This can take up to 30 seconds.</p>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Upload className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold">Upload lab report</p>
              <p className="text-sm text-muted-foreground">
                PDF or photo · any language
                <span className="hidden md:inline"> · drag & drop or click</span>
              </p>
            </div>
          </div>
        )}
      </Card>

      {error && !busy && (
        <Alert variant="destructive" className="rounded-xl">
          <AlertCircle />
          <AlertTitle>Couldn't read that report</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>{error}</p>
            <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={onRetry}>
              <RotateCcw /> Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {showSamples && !busy && (
        <p className="text-sm text-muted-foreground">
          No file handy? Load a sample:{" "}
          <Button variant="link" className="h-11 px-1 md:h-auto" onClick={() => onSample(1)}>
            Berlin 2026
          </Button>
          ·
          <Button variant="link" className="h-11 px-1 md:h-auto" onClick={() => onSample(2)}>
            Istanbul 2025
          </Button>
        </p>
      )}
    </div>
  )
}
