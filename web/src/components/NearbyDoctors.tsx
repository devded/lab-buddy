import { useEffect, useState, type FormEvent } from "react"
import { AlertCircle, Clock, Globe, Languages, LocateFixed, MapPin, Navigation, Phone, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Doctor, DoctorSpecialty } from "@/types"

const VISIBLE = 6
const km = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`)
const LANG_NAMES: Record<string, string> = {
  en: "English", de: "Deutsch", tr: "Türkçe", ar: "العربية", bn: "বাংলা", fr: "Français", es: "Español",
  ru: "Русский", pl: "Polski", fa: "فارسی", uk: "Українська",
}

/** Real practices nearby (OpenStreetMap) matching the specialties this report's abnormal values point to. */
export function NearbyDoctors({ reportId, defaultCity }: { reportId: number; defaultCity: string }) {
  const [specialties, setSpecialties] = useState<DoctorSpecialty[] | null>(null)
  const [doctors, setDoctors] = useState<Doctor[] | null>(null)
  const [filter, setFilter] = useState<string | null>(null)
  const [postcode, setPostcode] = useState("")
  const [city, setCity] = useState(defaultCity)
  const [where, setWhere] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const geoAllowed = typeof window !== "undefined" && window.isSecureContext && "geolocation" in navigator

  useEffect(() => {
    setDoctors(null)
    setWhere(null)
    setFilter(null)
    api.doctors(reportId).then((d) => setSpecialties(d.specialties), () => setSpecialties([]))
  }, [reportId])

  const search = async (at: { lat: number; lon: number }, label: string) => {
    setBusy(true)
    setError(null)
    try {
      const d = await api.doctors(reportId, at)
      setDoctors(d.doctors)
      setWhere(label)
      setShowAll(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onPlace = async (e: FormEvent) => {
    e.preventDefault()
    if (!postcode.trim() && !city.trim()) return
    setBusy(true)
    setError(null)
    try {
      const p = await api.geocode(postcode, city)
      await search(p, p.label)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const onLocate = () => {
    setBusy(true)
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => search({ lat: pos.coords.latitude, lon: pos.coords.longitude }, "your location"),
      () => {
        setBusy(false)
        setError("Location permission denied. Type a postcode instead.")
      },
      { timeout: 10000, maximumAge: 300000 },
    )
  }

  const shown = (doctors ?? []).filter((d) => !filter || d.specialty_key === filter)
  const missing = doctors ? (specialties ?? []).filter((s) => !doctors.some((d) => d.specialty_key === s.key)) : []

  return (
    <Card className="gap-4 rounded-2xl p-4 shadow-sm md:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="size-5 text-primary" /> Doctors near you
        </h2>
        <p className="text-sm text-muted-foreground">Practices that fit the values flagged on this report.</p>
      </div>

      {specialties === null ? (
        <Skeleton className="h-9 w-2/3" />
      ) : (
        <div className="flex flex-wrap gap-2">
          {specialties.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setFilter((f) => (f === s.key ? null : s.key))}
              className={cn(
                "min-h-11 rounded-xl border px-3 py-1.5 text-left text-sm transition-colors md:min-h-9",
                filter === s.key ? "border-primary bg-primary/10" : "bg-background hover:bg-muted/50",
              )}
            >
              <span className="font-semibold">{s.label_en}</span>
              <span className="block text-xs text-muted-foreground">
                {s.label_de}
                {s.tests.length > 0 && ` · for ${s.tests.join(", ")}`}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        {geoAllowed && (
          <Button variant="outline" className="h-11 md:h-10" onClick={onLocate} disabled={busy}>
            <LocateFixed /> Use my location
          </Button>
        )}
        <form onSubmit={onPlace} className="flex flex-1 gap-2">
          <Input
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            placeholder="Postcode"
            aria-label="Postcode"
            inputMode="numeric"
            autoComplete="postal-code"
            className="h-11 w-28 shrink-0 text-base md:h-10 md:text-sm"
          />
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            aria-label="City"
            autoComplete="address-level2"
            className="h-11 min-w-0 flex-1 text-base md:h-10 md:text-sm"
          />
          <Button type="submit" className="h-11 md:h-10" disabled={busy || (!postcode.trim() && !city.trim())}>
            <Search /> <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
        </form>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {busy ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : doctors ? (
        <>
          <p className="text-sm text-muted-foreground">
            {shown.length} {shown.length === 1 ? "practice" : "practices"} within ~3 km of {where}
          </p>
          {missing.length > 0 && (
            <Alert>
              <AlertCircle />
              <AlertDescription>
                No {missing.map((m) => m.label_en).join(" / ")} practice listed nearby. In Germany, start with a
                Hausarzt and ask for a referral (<span lang="de">Überweisung</span>) to a{" "}
                {missing.map((m) => m.label_de).join(" / ")}.
              </AlertDescription>
            </Alert>
          )}
          <ul className="grid gap-3 md:grid-cols-2">
            {(showAll ? shown : shown.slice(0, VISIBLE)).map((d) => (
              <li key={d.id} className="flex flex-col gap-2 rounded-xl border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-base leading-snug font-semibold">{d.name}</p>
                  <Badge variant="secondary" className="shrink-0">
                    {km(d.distance_m)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {specialties?.find((s) => s.key === d.specialty_key)?.label_en}
                  {d.address && ` · ${d.address}`}
                </p>
                {d.opening_hours && (
                  <p className="flex items-start gap-1.5 text-sm">
                    <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="break-words">{d.opening_hours}</span>
                  </p>
                )}
                {d.languages.length > 0 && (
                  <p className="flex items-center gap-1.5 text-sm">
                    <Languages className="size-4 shrink-0 text-muted-foreground" />
                    {d.languages.map((l) => LANG_NAMES[l] ?? l).join(", ")}
                  </p>
                )}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" className="h-11 flex-1 md:h-8">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation /> Directions
                    </a>
                  </Button>
                  {d.phone && (
                    <Button asChild size="sm" variant="outline" className="h-11 flex-1 md:h-8">
                      <a href={`tel:${d.phone.replace(/\s/g, "")}`}>
                        <Phone /> Call
                      </a>
                    </Button>
                  )}
                  {d.website && (
                    <Button asChild size="sm" variant="outline" className="h-11 md:h-8">
                      <a href={d.website} target="_blank" rel="noreferrer" aria-label={`Website of ${d.name}`}>
                        <Globe />
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {shown.length > VISIBLE && (
            <Button variant="ghost" className="h-11 w-full md:h-9" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Show fewer" : `Show all ${shown.length}`}
            </Button>
          )}
        </>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Your location is sent to OpenStreetMap only for this search and is not saved. Listings may be incomplete; call
        ahead. Emergencies: 112 · out-of-hours doctor: 116 117. Map data © OpenStreetMap contributors.
      </p>
    </Card>
  )
}
