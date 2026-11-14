import { FlaskConical, Languages, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Lang } from "@/types"

const LANGS: { value: Lang; label: string }[] = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "bn", label: "বাংলা" },
  { value: "tr", label: "Türkçe" },
]

export function Header({
  lang,
  onLangChange,
  username,
  onSignOut,
}: {
  lang: Lang
  onLangChange: (l: Lang) => void
  username: string
  onSignOut: () => void
}) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FlaskConical className="size-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">Lab Buddy</span>
          <span className="hidden truncate text-sm text-muted-foreground md:inline">
            · Your lab results, in your language
          </span>
        </div>
        <div className="flex items-center gap-1.5">
        <Select value={lang} onValueChange={(v) => onLangChange(v as Lang)}>
          <SelectTrigger className="data-[size=default]:h-11 min-w-32 bg-background text-base md:text-sm" aria-label="Explanation language">
            <Languages className="size-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {LANGS.map((l) => (
              <SelectItem key={l.value} value={l.value} className="min-h-11 text-base md:min-h-9 md:text-sm">
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
          <span className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <User className="size-4" /> {username}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" className="size-11 sm:w-auto sm:px-3" onClick={onSignOut} aria-label="Sign out">
                <LogOut /> <span className="hidden sm:inline">Sign out</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Signed in as {username}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  )
}
