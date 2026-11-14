import { useEffect, useRef, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { LogEntry } from "@/types"

const POLL_MS = 3000
const isMcp = (e: LogEntry) => e.actor.startsWith("mcp")

/**
 * Polls the access log once for the whole app (desktop panel and mobile sheet share it).
 * New rows flash; new MCP rows toast and bump `unseen` while the mobile sheet is closed.
 * The first batch only seeds what's "seen" (no flash, no toast).
 */
export function useAccessLog(sheetOpen: boolean) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [flash, setFlash] = useState<Set<number>>(new Set())
  const [unseen, setUnseen] = useState(0)
  const [offline, setOffline] = useState(false)
  const seen = useRef<Set<number> | null>(null)
  const sheetOpenRef = useRef(sheetOpen)

  useEffect(() => {
    sheetOpenRef.current = sheetOpen
    if (sheetOpen) setUnseen(0)
  }, [sheetOpen])

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    const poll = async () => {
      try {
        const rows = await api.accessLog()
        if (cancelled) return
        setOffline(false)
        setEntries(rows)
        if (seen.current == null) {
          seen.current = new Set(rows.map((r) => r.id))
          return
        }
        const fresh = rows.filter((r) => !seen.current!.has(r.id))
        if (!fresh.length) return
        fresh.forEach((r) => seen.current!.add(r.id))
        const ids = fresh.map((r) => r.id)
        setFlash((f) => new Set([...f, ...ids]))
        timers.push(
          window.setTimeout(() => {
            setFlash((f) => new Set([...f].filter((id) => !ids.includes(id))))
          }, 2000),
        )
        const mcp = fresh.filter(isMcp)
        mcp.forEach((r) => toast(`AI read: ${r.action}`, { description: r.scope, icon: <ShieldCheck className="size-4" /> }))
        if (mcp.length && !sheetOpenRef.current) setUnseen((n) => n + mcp.length)
      } catch {
        if (!cancelled) setOffline(true)
      }
    }
    poll()
    const id = window.setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
      timers.forEach(window.clearTimeout)
    }
  }, [])

  return { entries: entries.slice(0, 10), flash, unseen, offline }
}

function formatTime(ts: string) {
  const d = new Date(ts.replace(" ", "T") + "Z")
  return Number.isNaN(d.getTime())
    ? ts
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

export function LiveDot() {
  return (
    <span className="relative flex size-2.5">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-500 opacity-75" />
      <span className="relative inline-flex size-2.5 rounded-full bg-green-500" />
    </span>
  )
}

export function AccessLogTitle() {
  return (
    <span className="flex items-center gap-2 text-lg font-semibold">
      <ShieldCheck className="size-5 text-primary" />
      AI access log
      <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-700">
        <LiveDot /> live
      </span>
    </span>
  )
}

/** List + footer; wrapped in a Card on desktop and a Sheet on mobile. */
export function AccessLog({
  entries,
  flash,
  offline,
  className,
}: {
  entries: LogEntry[]
  flash: Set<number>
  offline: boolean
  className?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      {offline && <p className="text-sm text-destructive">Can't reach the server. Retrying…</p>}
      <ScrollArea className={cn("h-[50vh] lg:h-[420px]", className)}>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No access yet. Ask your AI assistant about your lab results.
          </p>
        ) : (
          <ul className="space-y-1.5 pr-3">
            {entries.map((e) => {
              const mcp = isMcp(e)
              const client = e.actor.includes(":") ? e.actor.split(":").slice(1).join(":") : null
              return (
                <li
                  key={e.id}
                  className={cn("rounded-lg border bg-background p-2.5 text-sm", flash.has(e.id) && "animate-flash")}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{formatTime(e.ts)}</span>
                    <Badge
                      title={client ?? undefined}
                      className={cn(
                        "text-[10px] font-bold tracking-wide",
                        mcp ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {mcp ? "MCP" : "WEB"}
                    </Badge>
                    <span className="truncate font-mono text-xs font-medium">{e.action}</span>
                  </div>
                  {e.scope && <p className="mt-1 text-muted-foreground">{e.scope}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
      <p className="border-t pt-3 text-xs text-muted-foreground">
        AI assistants can only see abnormal results and the doctor brief.
      </p>
    </div>
  )
}
