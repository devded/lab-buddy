import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, ShieldCheck, Stethoscope, TriangleAlert } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { AccessLog, AccessLogTitle, useAccessLog } from "@/components/AccessLog"
import { CompareView } from "@/components/CompareView"
import { DoctorBrief } from "@/components/DoctorBrief"
import { EmptyState } from "@/components/EmptyState"
import { HistoryGrid } from "@/components/HistoryGrid"
import { Header } from "@/components/Header"
import { ReportTabs } from "@/components/ReportTabs"
import { ResultCard } from "@/components/ResultCard"
import { SummaryBar } from "@/components/SummaryBar"
import { UploadZone } from "@/components/UploadZone"
import { Login } from "@/components/Login"
import { api, setUnauthorizedHandler, token } from "@/lib/api"
import type { Flag, History, Lang, Report, ReportDetail } from "@/types"

const RANK: Record<Flag, number> = { high: 0, low: 0, unknown: 1, normal: 2 }

export default function App() {
  // undefined = checking stored token, null = signed out
  const [user, setUser] = useState<string | null | undefined>(() => (token.get() ? undefined : null))

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    if (token.get()) api.me().then((u) => setUser(u.username), () => setUser(null))
  }, [])

  const signOut = () => {
    api.logout().catch(() => {})
    token.set(null)
    setUser(null)
  }

  if (user === undefined) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-4 p-4">
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
    )
  }
  if (user === null) return <Login onSignedIn={setUser} />
  // key: a fresh dashboard per account, so no state leaks between users
  return <LabBuddy key={user} username={user} onSignOut={signOut} />
}

function LabBuddy({ username, onSignOut }: { username: string; onSignOut: () => void }) {
  const [lang, setLang] = useState<Lang>("en")
  const [reports, setReports] = useState<Report[] | null>(null)
  const [reportsError, setReportsError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ReportDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [compareTests, setCompareTests] = useState<string[]>([])
  const [compareKey, setCompareKey] = useState(0)
  const [compareTest, setCompareTest] = useState<string | null>(null)
  const [history, setHistory] = useState<History | null>(null)
  const compareRef = useRef<HTMLDivElement>(null)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const lastAdd = useRef<(() => Promise<ReportDetail>) | null>(null)
  const [briefOpen, setBriefOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const log = useAccessLog(logOpen)

  const loadReports = useCallback(async () => {
    try {
      const list = await api.reports()
      setReports(list)
      setReportsError(null)
      return list
    } catch (e) {
      setReportsError((e as Error).message)
      setReports((r) => r ?? [])
      return null
    }
  }, [])

  const loadCompareTests = useCallback(() => {
    api.compareTests().then(setCompareTests, () => setCompareTests([]))
    api.history().then(setHistory, () => setHistory({}))
    setCompareKey((k) => k + 1)
  }, [])

  // Initial load: pick the most recent report.
  useEffect(() => {
    loadReports().then((list) => {
      if (list?.length) setSelectedId(list[list.length - 1].id)
    })
    loadCompareTests()
  }, [loadReports, loadCompareTests])

  // Load selected report (and re-load explanations when language changes).
  useEffect(() => {
    if (selectedId == null) return
    let cancelled = false
    setDetailError(null)
    api
      .report(selectedId, lang)
      .then((d) => !cancelled && setDetail(d))
      .catch((e: Error) => {
        if (cancelled) return
        setDetailError(e.message)
        toast.error(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId, lang])

  const addReport = async (run: () => Promise<ReportDetail>) => {
    lastAdd.current = run
    setAdding(true)
    setAddError(null)
    try {
      const d = await run()
      toast.success("Report added")
      if (lang === "en") setDetail(d)
      setSelectedId(d.report.id)
      await loadReports()
      loadCompareTests()
    } catch (e) {
      setAddError((e as Error).message)
    } finally {
      setAdding(false)
    }
  }

  const hasReports = !!reports?.length
  const showingDetail = detail && detail.report.id === selectedId ? detail : null
  const results = showingDetail
    ? [...showingDetail.results].sort((a, b) => (RANK[a.flag] ?? 1) - (RANK[b.flag] ?? 1))
    : []

  return (
    <div className="min-h-dvh overflow-x-hidden">
      <Header lang={lang} onLangChange={setLang} username={username} onSignOut={onSignOut} />

      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-32 lg:pb-10">
        <Alert className="mb-4 rounded-xl border-amber-300 bg-amber-50 py-2 text-amber-900">
          <TriangleAlert className="text-amber-600" />
          <AlertDescription className="text-amber-900">Synthetic demo data. Not medical advice.</AlertDescription>
        </Alert>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-8">
            <UploadZone
              busy={adding}
              error={addError}
              onFile={(f) => addReport(() => api.upload(f))}
              onSample={(n) => addReport(() => api.loadSample(n))}
              onRetry={() => lastAdd.current && addReport(lastAdd.current)}
              showSamples={hasReports}
            />

            {reportsError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle />
                <AlertDescription>{reportsError}</AlertDescription>
              </Alert>
            )}

            {reports == null ? (
              <Skeleton className="h-11 w-64 rounded-xl" />
            ) : !hasReports ? (
              <EmptyState busy={adding} onSample={() => addReport(() => api.loadSample(1))} />
            ) : (
              <>
                <ReportTabs reports={reports} selectedId={selectedId} onSelect={setSelectedId} />

                {showingDetail ? (
                  <>
                    <SummaryBar results={results} onBrief={() => setBriefOpen(true)} />
                    {results.length === 0 ? (
                      <Card className="rounded-2xl p-5 text-center text-muted-foreground">
                        No test results were found in this report.
                      </Card>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {results.map((r) => (
                          <ResultCard key={r.id} result={r} sourceLanguage={showingDetail.report.source_language} />
                        ))}
                      </div>
                    )}
                  </>
                ) : detailError ? (
                  <Alert variant="destructive" className="rounded-xl">
                    <AlertCircle />
                    <AlertDescription>{detailError}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-56" />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-48 rounded-2xl" />
                      ))}
                    </div>
                  </div>
                )}

                <HistoryGrid
                  history={history}
                  selected={compareTest ?? compareTests[0] ?? null}
                  onPick={(t) => {
                    setCompareTest(t)
                    compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }}
                />
                <div ref={compareRef} className="scroll-mt-20">
                  <CompareView tests={compareTests} refreshKey={compareKey} test={compareTest} onTestChange={setCompareTest} />
                </div>
              </>
            )}
          </div>

          {/* Desktop: access log always visible */}
          <aside className="hidden lg:col-span-4 lg:block">
            <Card className="sticky top-20 gap-3 rounded-2xl p-5 shadow-sm">
              <AccessLogTitle />
              <AccessLog entries={log.entries} flash={log.flash} offline={log.offline} />
            </Card>
          </aside>
        </div>
      </main>

      {/* Mobile/tablet: sticky bottom action bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[1200px] gap-2 p-2">
          <Button className="h-12 flex-1 text-base" disabled={!showingDetail} onClick={() => setBriefOpen(true)}>
            <Stethoscope className="size-5" /> Doctor brief
          </Button>
          <Button variant="outline" className="relative h-12 flex-1 text-base" onClick={() => setLogOpen(true)}>
            <ShieldCheck className="size-5" /> AI log
            {log.unseen > 0 && (
              <span className="absolute top-1.5 right-2 flex items-center gap-1">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-500 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-purple-600" />
                </span>
                <span className="rounded-full bg-purple-600 px-1.5 text-xs font-bold text-white">{log.unseen}</span>
              </span>
            )}
          </Button>
        </div>
      </nav>

      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="px-0">
            <SheetTitle asChild>
              <div>
                <AccessLogTitle />
              </div>
            </SheetTitle>
            <SheetDescription>Every time an AI assistant reads your data, it shows up here.</SheetDescription>
          </SheetHeader>
          <AccessLog entries={log.entries} flash={log.flash} offline={log.offline} />
        </SheetContent>
      </Sheet>

      <DoctorBrief open={briefOpen} onOpenChange={setBriefOpen} reportId={showingDetail?.report.id ?? null} />
    </div>
  )
}
