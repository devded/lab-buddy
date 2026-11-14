import { useState } from "react"
import { AlertCircle, FlaskConical, Loader2, TriangleAlert } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api, token } from "@/lib/api"

export function Login({ onSignedIn }: { onSignedIn: (username: string) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const register = mode === "register"

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await (register ? api.register : api.login)(username.trim(), password)
      token.set(res.token)
      onSignedIn(res.username)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 py-8">
      <Alert className="w-full max-w-sm rounded-xl border-amber-300 bg-amber-50 py-2 text-amber-900">
        <TriangleAlert className="text-amber-600" />
        <AlertDescription className="text-amber-900">Synthetic demo data. Not medical advice.</AlertDescription>
      </Alert>

      <Card className="w-full max-w-sm gap-5 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <FlaskConical className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Lab Buddy</h1>
          <p className="text-sm text-muted-foreground">
            {register ? "Create an account to keep your reports." : "Sign in to see your lab reports."}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 4 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" className="h-12 w-full text-base" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            {register ? "Create account" : "Sign in"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-1 text-sm">
          <Button
            variant="link"
            className="h-11"
            onClick={() => {
              setMode(register ? "login" : "register")
              setError(null)
            }}
          >
            {register ? "Already have an account? Sign in" : "Create account"}
          </Button>
          {!register && (
            <p className="flex items-center gap-1 text-muted-foreground">
              Demo: demo / demo
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => {
                  setUsername("demo")
                  setPassword("demo")
                }}
              >
                Fill in
              </Button>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
