from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
import os

D = "/usr/share/fonts/truetype/dejavu/"
pdfmetrics.registerFont(TTFont("F", D + "DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("FB", D + "DejaVuSans-Bold.ttf"))
OUT = os.path.dirname(os.path.abspath(__file__))
W, H = A4
M = 18 * mm


def make(fn, cfg):
    c = canvas.Canvas(os.path.join(OUT, fn), pagesize=A4)
    c.setTitle(cfg["title"])
    # header
    c.setFillColor(colors.HexColor("#1b4f72"))
    c.rect(0, H - 32 * mm, W, 32 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("FB", 17); c.drawString(M, H - 14 * mm, cfg["lab"])
    c.setFont("F", 8.5)
    for i, l in enumerate(cfg["addr"]):
        c.drawString(M, H - 20 * mm - i * 4 * mm, l)
    c.setFont("FB", 13); c.drawRightString(W - M, H - 14 * mm, cfg["title"])
    # patient box
    top = H - 40 * mm
    c.setFillColor(colors.HexColor("#f2f4f6")); c.setStrokeColor(colors.grey)
    c.roundRect(M, top - 24 * mm, W - 2 * M, 24 * mm, 2 * mm, fill=1, stroke=1)
    c.setFillColor(colors.black)
    for i, (k, v) in enumerate(cfg["patient"]):
        x = M + 4 * mm + (i % 2) * 85 * mm
        y = top - 7 * mm - (i // 2) * 7 * mm
        c.setFont("F", 8); c.setFillColor(colors.grey); c.drawString(x, y, k)
        c.setFont("FB", 10); c.setFillColor(colors.black); c.drawString(x + 30 * mm, y, v)
    # table
    y = top - 36 * mm
    xs, rights = cfg["cols"]
    c.setFillColor(colors.HexColor("#d6e4f0"))
    c.rect(M, y - 2 * mm, W - 2 * M, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.black); c.setFont("FB", 9)
    for h, x in zip(cfg["heads"], xs):
        c.drawString(M + x * mm, y + 0.5 * mm, h)
    y -= 2 * mm
    for row in cfg["rows"]:
        y -= 9 * mm
        flag = len(row) > 4 and row[4]
        c.setFont("FB" if flag else "F", 10)
        for v, x in zip(row, xs):
            c.drawString(M + x * mm, y + 3 * mm, v)
        c.setStrokeColor(colors.lightgrey); c.setLineWidth(0.4)
        c.line(M, y, W - M, y)
    c.setStrokeColor(colors.black); c.setLineWidth(0.8)
    c.line(M, y - 1 * mm, W - M, y - 1 * mm)
    c.setFont("F", 8); c.setFillColor(colors.grey)
    c.drawString(M, y - 6 * mm, cfg["legend"])
    # signature + footer
    c.setFillColor(colors.black); c.setStrokeColor(colors.black); c.setLineWidth(0.5)
    c.line(W - M - 60 * mm, 50 * mm, W - M, 50 * mm)
    c.setFont("F", 8); c.drawRightString(W - M, 45 * mm, cfg["sign"])
    c.setFont("FB", 8)
    c.setFillColor(colors.HexColor("#b03a2e"))
    c.drawCentredString(W / 2, 22 * mm, cfg["footer"])
    c.setStrokeColor(colors.grey); c.line(M, 27 * mm, W - M, 27 * mm)
    c.save()


make("1_berlin_de.pdf", dict(
    title="Laborbefund", lab="Labor Berlin-Mitte MVZ",
    addr=["Invalidenstraße 112 · 10115 Berlin · Deutschland", "Tel. +49 30 5550 1234 · Fax +49 30 5550 1299"],
    patient=[("Patient/in:", "Demo Patient"), ("geb.:", "01.01.2001"),
             ("Befunddatum:", "12.03.2026"), ("Material:", "Serum / EDTA-Blut"),
             ("Auftragsnr.:", "B-2026-031247"), ("Einsender:", "Hausarztpraxis Mitte")],
    heads=["Untersuchung", "Ergebnis", "Einheit", "Referenzbereich", "Flag"],
    cols=([0, 62, 88, 115, 160], 0),
    rows=[("Hämoglobin", "13,8", "g/dl", "12,0 – 16,0"),
          ("Leukozyten", "6,2", "/nl", "3,9 – 10,2"),
          ("Glukose (nüchtern)", "98", "mg/dl", "70 – 99"),
          ("HbA1c", "6,1", "%", "4,0 – 5,6", "H"),
          ("Kreatinin", "0,9", "mg/dl", "0,5 – 1,0"),
          ("TSH", "2,1", "mU/l", "0,27 – 4,2"),
          ("25-OH-Vitamin D", "14", "ng/ml", "30 – 100", "L"),
          ("Ferritin", "45", "ng/ml", "15 – 150")],
    legend="H = erhöht, L = erniedrigt (außerhalb des Referenzbereichs)",
    sign="Dr. med. A. Beispiel, Fachärztin für Labormedizin",
    footer="Synthetische Demodaten – keine medizinischen Befunde"))

make("2_istanbul_tr.pdf", dict(
    title="Laboratuvar Sonuç Raporu", lab="Anadolu Tıp Laboratuvarı",
    addr=["Bağdat Caddesi No: 245, Kadıköy · İstanbul · Türkiye", "Tel: +90 216 555 01 23"],
    patient=[("Hasta:", "Demo Patient"), ("Doğum Tarihi:", "01.01.2001"),
             ("Rapor Tarihi:", "18.04.2025"), ("Numune:", "Serum / EDTA Kan"),
             ("Protokol No:", "AT-2025-048213"), ("İstek Yapan:", "Aile Hekimliği")],
    heads=["Test Adı", "Sonuç", "Birim", "Referans Aralığı"],
    cols=([0, 70, 100, 130], 0),
    rows=[("Hemoglobin", "14,1", "g/dL", "12 – 16"),
          ("Lökosit", "7,0", "10^3/µL", "4 – 10"),
          ("Açlık Kan Şekeri", "92", "mg/dL", "70 – 100"),
          ("HbA1c", "5,6", "%", "4,0 – 5,7"),
          ("Kreatinin", "0,8", "mg/dL", "0,6 – 1,1"),
          ("TSH", "1,9", "µIU/mL", "0,4 – 4,0"),
          ("Vitamin D (25-OH)", "22", "ng/mL", "20 – 100"),
          ("Ferritin", "60", "ng/mL", "13 – 150")],
    legend="Sonuçlar referans aralığı ile birlikte verilmiştir.",
    sign="Uzm. Dr. B. Örnek, Klinik Biyokimya Uzmanı",
    footer="Sentetik demo verisi – tıbbi sonuç değildir"))
