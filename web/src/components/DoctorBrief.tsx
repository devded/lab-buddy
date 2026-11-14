import { useEffect, useState } from "react"
import { AlertCircle, Check, Copy, Languages } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { useMediaQuery } from "@/hooks/use-media-query"
import { api } from "@/lib/api"
import type { Brief } from "@/types"

// navigator.clipboard only exists on https/localhost; phones on LAN http need the fallback.
async function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text)
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"
  ta.style.opacity = "0"
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand("copy")
  document.body.removeChild(ta)
  if (!ok) throw new Error("copy failed")
}

const TITLE = "Für Ihren Arzt / For your doctor"
const DESC = "Abnormal values only, in formal German. Show it to your doctor or paste it into a message."

export function DoctorBrief({
  open,
  onOpenChange,
  reportId,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  reportId: number | null
}) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const [cache, setCache] = useState<Record<number, Brief>>({})
  const [error, setError] = useState<string | null>(null)
  const [english, setEnglish] = useState(false)
  const [copied, setCopied] = useState(false)
  const brief = reportId != null ? cache[reportId] : undefined

  useEffect(() => {
    if (!open || reportId == null || cache[reportId]) return
    let cancelled = false
    setError(null)
    api
      .brief(reportId)
      .then((b) => !cancelled && setCache((c) => ({ ...c, [reportId]: b })))
      .catch((e: Error) => !cancelled && setError(e.message))
    return () => {
      cancelled = true
    }
  }, [open, reportId, cache])

  const text = brief ? (english ? brief.en : brief.de) : ""

  const copy = async () => {
    try {
      await copyText(text)
      setCopied(true)
      toast.success("Copied")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.")
    }
  }

  const body = error ? (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : !brief ? (
    <div className="space-y-2 rounded-xl border bg-slate-50 p-4">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  ) : (
    <ScrollArea className="h-[45vh] rounded-xl border bg-slate-50 md:h-80">
      <p lang={english ? "en" : "de"} className="p-4 text-base leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
    </ScrollArea>
  )

  const actions = (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <Button variant="outline" className="h-12 md:h-10" disabled={!brief} onClick={() => setEnglish((e) => !e)}>
        <Languages /> {english ? "Show in German" : "Show in English"}
      </Button>
      <Button className="h-12 md:h-10" disabled={!brief} onClick={copy}>
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-2xl p-6 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">{TITLE}</DialogTitle>
            <DialogDescription>{DESC}</DialogDescription>
          </DialogHeader>
          {body}
          {actions}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{TITLE}</DrawerTitle>
          <DrawerDescription>{DESC}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">{body}</div>
        <DrawerFooter className="pb-[max(1rem,env(safe-area-inset-bottom))]">{actions}</DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
