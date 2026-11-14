import type { AuthResponse, Brief, CompareRow, History, Lang, LogEntry, Report, ReportDetail, User } from "@/types"

const TOKEN_KEY = "labbuddy.token"

export const token = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(t: string | null) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* storage blocked (private mode): token lives only for this session */
    }
  },
}

/** App registers this to show the login screen when the session expires. */
let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const t = token.get()
  if (t) headers.set("Authorization", `Bearer ${t}`)
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new Error("Can't reach the server. Is the backend running?")
  }
  // Bad credentials on login/register are a form error, not an expired session.
  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    token.set(null)
    onUnauthorized()
  }
  if (!res.ok) {
    let msg = `Something went wrong (${res.status}). Please try again.`
    try {
      const body = await res.json()
      if (typeof body?.detail === "string") msg = body.detail
      // FastAPI validation errors: [{msg: "..."}]
      else if (typeof body?.detail?.[0]?.msg === "string") msg = body.detail[0].msg
    } catch {
      /* non-JSON error body: keep the generic message */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
})

export const api = {
  login: (username: string, password: string) => request<AuthResponse>("/auth/login", json({ username, password })),
  register: (username: string, password: string) =>
    request<AuthResponse>("/auth/register", json({ username, password })),
  logout: () => request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
  me: () => request<User>("/auth/me"),
  upload(file: File) {
    const form = new FormData()
    form.append("file", file)
    return request<ReportDetail>("/upload", { method: "POST", body: form })
  },
  loadSample: (n: 1 | 2) => request<ReportDetail>(`/load-sample/${n}`, { method: "POST" }),
  reports: () => request<Report[]>("/reports"),
  report: (id: number, lang: Lang) => request<ReportDetail>(`/reports/${id}?lang=${lang}`),
  brief: (id: number) => request<Brief>(`/reports/${id}/brief`),
  compareTests: () => request<string[]>("/compare/tests"),
  compare: (test: string) => request<CompareRow[]>(`/compare?test=${encodeURIComponent(test)}`),
  accessLog: () => request<LogEntry[]>("/access-log"),
  history: () => request<History>("/history"),
}

const LANG_CODES: Record<string, string> = {
  german: "DE", turkish: "TR", bangla: "BN", bengali: "BN", english: "EN", arabic: "AR",
  spanish: "ES", french: "FR", persian: "FA", urdu: "UR", hindi: "HI", russian: "RU", ukrainian: "UK",
}

/** "Berlin · 2026 · DE" */
export function reportLabel(r: {
  city: string | null
  country: string | null
  report_date: string | null
  source_language: string | null
}) {
  return [
    r.city ?? r.country ?? "Report",
    r.report_date?.slice(0, 4),
    r.source_language && (LANG_CODES[r.source_language.toLowerCase()] ?? r.source_language.slice(0, 2).toUpperCase()),
  ]
    .filter(Boolean)
    .join(" · ")
}

export const isAbnormal = (f: string) => f === "high" || f === "low"
