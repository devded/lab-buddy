import { useState } from "react"
import { createPortal } from "react-dom"
import { FileDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, isAbnormal } from "@/lib/api"
import type { Brief, Flag, Lang, ReportDetail } from "@/types"

const LANG_LABEL: Record<Lang, string> = { en: "English", de: "Deutsch", bn: "বাংলা", tr: "Türkçe" }

// Printout labels per language (the on-screen UI stays English; the PDF is for the user and their doctor).
const T: Record<Lang, Record<string, string>> = {
  en: {
    title: "Lab report summary", lab: "Lab", place: "Place", date: "Report date", language: "Report language",
    attention: "need attention", normal: "normal", test: "Test", result: "Result", range: "Normal range (this report)",
    status: "Status", about: "What it measures", note: "Note for your doctor (German)", noteEn: "English translation",
    disclaimer: "Synthetic demo data. Not medical advice. Values and ranges are copied from the original report.",
    made: "Created with Lab Buddy on", high: "HIGH", low: "LOW", normalF: "NORMAL", unknown: "UNCLEAR",
  },
  de: {
    title: "Zusammenfassung Laborbefund", lab: "Labor", place: "Ort", date: "Befunddatum", language: "Sprache des Befunds",
    attention: "auffällig", normal: "im Normbereich", test: "Untersuchung", result: "Ergebnis",
    range: "Referenzbereich (dieser Befund)", status: "Status", about: "Was wird gemessen", note: "Hinweis für Ihren Arzt",
    noteEn: "Englische Übersetzung", disclaimer: "Synthetische Demodaten. Keine medizinische Beratung. Werte und Bereiche stammen aus dem Originalbefund.",
    made: "Erstellt mit Lab Buddy am", high: "HOCH", low: "NIEDRIG", normalF: "NORMAL", unknown: "UNKLAR",
  },
  bn: {
    title: "ল্যাব রিপোর্টের সারসংক্ষেপ", lab: "ল্যাব", place: "স্থান", date: "রিপোর্টের তারিখ", language: "রিপোর্টের ভাষা",
    attention: "মনোযোগ প্রয়োজন", normal: "স্বাভাবিক", test: "পরীক্ষা", result: "ফলাফল", range: "স্বাভাবিক সীমা (এই রিপোর্ট)",
    status: "অবস্থা", about: "এটি কী মাপে", note: "ডাক্তারের জন্য নোট (জার্মান)", noteEn: "ইংরেজি অনুবাদ",
    disclaimer: "কৃত্রিম ডেমো ডেটা। চিকিৎসা পরামর্শ নয়। মান ও সীমা মূল রিপোর্ট থেকে নেওয়া।",
    made: "Lab Buddy দিয়ে তৈরি", high: "বেশি", low: "কম", normalF: "স্বাভাবিক", unknown: "অস্পষ্ট",
  },
  tr: {
    title: "Laboratuvar raporu özeti", lab: "Laboratuvar", place: "Yer", date: "Rapor tarihi", language: "Rapor dili",
    attention: "dikkat gerektiriyor", normal: "normal", test: "Test", result: "Sonuç", range: "Normal aralık (bu rapor)",
    status: "Durum", about: "Neyi ölçer", note: "Doktorunuz için not (Almanca)", noteEn: "İngilizce çeviri",
    disclaimer: "Sentetik demo verisi. Tıbbi tavsiye değildir. Değerler ve aralıklar orijinal rapordan alınmıştır.",
    made: "Lab Buddy ile oluşturuldu:", high: "YÜKSEK", low: "DÜŞÜK", normalF: "NORMAL", unknown: "BELİRSİZ",
  },
}
const FLAG_KEY: Record<Flag, string> = { high: "high", low: "low", normal: "normalF", unknown: "unknown" }
const FLAG_COLOR: Record<Flag, string> = { high: "#D93025", low: "#1A73E8", normal: "#188038", unknown: "#64748b" }
const RANK: Record<Flag, number> = { high: 0, low: 0, unknown: 1, normal: 2 }

/** Language picker + "Export PDF": fetches the report in that language, renders a print layout, opens Save-as-PDF. */
/** Language is shared with the header picker (one source of truth in App), so both always match. */
export function ExportPdf({ reportId, lang, onLangChange }: { reportId: number; lang: Lang; onLangChange: (l: Lang) => void }) {
  const [busy, setBusy] = useState(false)
  const [doc, setDoc] = useState<{ detail: ReportDetail; brief: Brief | null; lang: Lang } | null>(null)

  const run = async () => {
    setBusy(true)
    try {
      const [detail, brief] = await Promise.all([api.report(reportId, lang), api.brief(reportId).catch(() => null)])
      if (detail.lang !== lang) toast.warning("Translation is busy, so the PDF explanations are in English. Try again in a minute.")
      setDoc({ detail, brief, lang })
      const r = detail.report
      const prevTitle = document.title
      document.title = ["LabBuddy", r.city ?? r.country, r.report_date, lang.toUpperCase()].filter(Boolean).join("_")
      // Let React paint the print layout, then open the print dialog (choose "Save as PDF").
      await new Promise((res) => setTimeout(res, 150))
      window.addEventListener("afterprint", () => (document.title = prevTitle), { once: true })
      window.print()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Select value={lang} onValueChange={(v) => onLangChange(v as Lang)}>
          <SelectTrigger className="w-32 text-base data-[size=default]:h-11 md:text-sm md:data-[size=default]:h-10" aria-label="PDF language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper">
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
              <SelectItem key={l} value={l} className="min-h-11 text-base md:min-h-9 md:text-sm">
                {LANG_LABEL[l]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11 md:h-10" onClick={run} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <FileDown />} Export PDF
        </Button>
      </div>
      {doc && createPortal(<PrintReport {...doc} />, document.body)}
    </>
  )
}

function PrintReport({ detail, brief, lang }: { detail: ReportDetail; brief: Brief | null; lang: Lang }) {
  const t = T[lang]
  const r = detail.report
  const results = [...detail.results].sort((a, b) => RANK[a.flag] - RANK[b.flag])
  const abnormal = results.filter((x) => isAbnormal(x.flag)).length

  return (
    <div lang={lang} className="hidden bg-white text-[11pt] leading-snug text-black print:block">
      <header className="flex items-end justify-between border-b-2 border-[#1A73E8] pb-2">
        <div>
          <p className="text-[9pt] font-semibold tracking-wide text-[#1A73E8] uppercase">Lab Buddy</p>
          <h1 className="text-[18pt] font-bold">{t.title}</h1>
        </div>
        <p className="text-right text-[9pt] text-slate-600">
          {t.made} {new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : lang)}
        </p>
      </header>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[10pt]">
        {[
          [t.lab, r.lab_name],
          [t.place, [r.city, r.country].filter(Boolean).join(", ")],
          [t.date, r.report_date],
          [t.language, r.source_language],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="text-slate-600">{k}:</dt>
            <dd className="font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[11pt]">
        <b style={{ color: FLAG_COLOR.high }}>{abnormal}</b> {t.attention} ·{" "}
        <b style={{ color: FLAG_COLOR.normal }}>{results.filter((x) => x.flag === "normal").length}</b> {t.normal}
      </p>

      <table className="mt-2 w-full border-collapse text-[10pt]">
        <thead>
          <tr className="border-b border-slate-400 text-left">
            <th className="py-1.5 pr-2">{t.test}</th>
            <th className="py-1.5 pr-2">{t.result}</th>
            <th className="py-1.5 pr-2">{t.range}</th>
            <th className="py-1.5 pr-2">{t.status}</th>
            <th className="py-1.5">{t.about}</th>
          </tr>
        </thead>
        <tbody>
          {results.map((x) => (
            <tr key={x.id} className="break-inside-avoid border-b border-slate-200 align-top">
              <td className="py-1.5 pr-2">
                <b>{x.name_en}</b>
                {x.original_name !== x.name_en && <div className="text-[9pt] text-slate-600">{x.original_name}</div>}
              </td>
              <td className="py-1.5 pr-2 font-semibold whitespace-nowrap">
                {x.value_text ?? x.value ?? "—"} {x.unit}
              </td>
              <td className="py-1.5 pr-2 whitespace-nowrap">{x.range_text ?? "—"}</td>
              <td className="py-1.5 pr-2 font-bold whitespace-nowrap" style={{ color: FLAG_COLOR[x.flag] }}>
                {t[FLAG_KEY[x.flag]]}
              </td>
              <td className="py-1.5 text-[9.5pt]">{x.explanation}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {brief && abnormal > 0 && (
        <section className="mt-5 break-inside-avoid rounded border border-slate-300 p-3">
          <h2 className="text-[12pt] font-bold">{t.note}</h2>
          <p lang="de" className="mt-1 whitespace-pre-wrap">{brief.de}</p>
          {lang !== "de" && (
            <>
              <h3 className="mt-2 text-[9pt] font-semibold text-slate-600">{t.noteEn}</h3>
              <p lang="en" className="text-[9.5pt] whitespace-pre-wrap text-slate-700">{brief.en}</p>
            </>
          )}
        </section>
      )}

      <footer className="mt-5 border-t border-slate-300 pt-2 text-[8.5pt] text-slate-600">{t.disclaimer}</footer>
    </div>
  )
}
