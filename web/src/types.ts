export type Flag = "low" | "normal" | "high" | "unknown"
export type Lang = "en" | "de" | "bn" | "tr"

export interface Report {
  id: number
  filename: string
  lab_name: string | null
  country: string | null
  city: string | null
  report_date: string | null // YYYY-MM-DD
  source_language: string | null // e.g. "German"
  created_at: string
}

export interface Result {
  id: number
  report_id: number
  name_en: string
  original_name: string
  value: number | null
  value_text: string | null
  unit: string | null
  range_low: number | null
  range_high: number | null
  range_text: string | null
  flag: Flag
  explanation: string // already in requested lang
}

export interface ReportDetail {
  report: Report
  results: Result[]
  lang: Lang // language the explanations are actually in (falls back to "en" if translation failed)
}

export interface Brief {
  de: string
  en: string
}

export interface CompareRow {
  report_id: number
  city: string | null
  country: string | null
  report_date: string | null
  source_language: string | null
  value: number | null
  value_text: string | null
  unit: string | null
  flag: Flag
  range_text: string | null
  range_low: number | null
  range_high: number | null
}

export type History = Record<string, CompareRow[]>

export interface LogEntry {
  id: number
  ts: string // "YYYY-MM-DD HH:MM:SS" UTC
  actor: string // "web" | "mcp" | "mcp:<client>"
  action: string
  scope: string
}

export interface User {
  username: string
}

export interface AuthResponse {
  token: string
  username: string
}

export interface DoctorSpecialty {
  key: string
  label_en: string
  label_de: string
  tests: string[]
}

export interface Doctor {
  id: string
  name: string
  speciality: string
  specialty_key: string
  address: string
  phone: string | null
  website: string | null
  opening_hours: string | null
  wheelchair: string | null
  languages: string[]
  lat: number
  lon: number
  distance_m: number
}

export interface DoctorSearch {
  specialties: DoctorSpecialty[]
  doctors: Doctor[]
}

export interface Place {
  lat: number
  lon: number
  label: string
}
