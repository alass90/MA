# SKILL: PDF Document Generation

You are now in **PDF Builder mode**. Read every line before generating.

---

## 1. ROUTE SELECTION (DECIDE FIRST)

Choose your route based on the document type:

| Document Type | Route | Tool |
|--------------|-------|------|
| Business report, proposal, invoice | **HTML Route** | wkhtmltopdf |
| Academic paper, math-heavy content | **LaTeX Route** | pdflatex / wkhtmltopdf |
| Existing PDF manipulation | **Process Route** | pypdf / pdfplumber |
| Office doc to PDF | **Convert Route** | LibreOffice |

Read the corresponding route section below after choosing.

---

## 2. ROUTE A: HTML → PDF (Most Common)

Best for: business reports, invoices, dashboards, marketing materials.

### Step 1: Generate HTML
```python
html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document Title</title>
    <style>
        /* ── PAGE SETUP ── */
        @page {
            margin: 2.5cm 2cm;
            size: A4;
        }
        @page:first {
            margin-top: 0;
        }
        
        /* ── TYPOGRAPHY ── */
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', -apple-system, sans-serif;
            font-size: 10pt;
            line-height: 1.6;
            color: #1e293b;
        }
        
        /* ── HEADINGS ── */
        h1 { font-size: 24pt; font-weight: 700; color: #1e3a5f; margin-bottom: 8pt; }
        h2 { font-size: 14pt; font-weight: 600; color: #1e3a5f; margin: 20pt 0 8pt; 
             padding-bottom: 4pt; border-bottom: 2px solid #2563eb; }
        h3 { font-size: 11pt; font-weight: 600; color: #334155; margin: 14pt 0 6pt; }
        
        /* ── BODY TEXT ── */
        p { margin-bottom: 8pt; color: #475569; }
        
        /* ── COVER PAGE ── */
        .cover {
            height: 29.7cm;
            background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%);
            display: flex;
            flex-direction: column;
            justify-content: center;
            padding: 3cm;
            page-break-after: always;
        }
        .cover h1 { color: white; font-size: 32pt; }
        .cover .subtitle { color: rgba(255,255,255,0.8); font-size: 14pt; margin-top: 16pt; }
        .cover .meta { color: rgba(255,255,255,0.7); font-size: 10pt; margin-top: 40pt; }
        
        /* ── TABLES ── */
        table { width: 100%; border-collapse: collapse; margin: 12pt 0; font-size: 9pt; }
        thead { background: #2563eb; color: white; }
        thead th { padding: 8pt 10pt; text-align: left; font-weight: 600; }
        tbody tr:nth-child(even) { background: #eff6ff; }
        tbody td { padding: 6pt 10pt; border-bottom: 1px solid #e2e8f0; }
        
        /* ── CALL-OUT BOXES ── */
        .callout {
            background: #eff6ff;
            border-left: 4px solid #2563eb;
            padding: 12pt 16pt;
            margin: 12pt 0;
            border-radius: 0 6pt 6pt 0;
        }
        .callout.warning { background: #fefce8; border-color: #eab308; }
        .callout.danger  { background: #fff1f2; border-color: #ef4444; }
        
        /* ── PAGE NUMBERS ── */
        .page-number:after { content: counter(page); }
        
        /* ── PAGE BREAK ── */
        .page-break { page-break-after: always; }
        
        /* ── FOOTER ── */
        footer {
            position: fixed;
            bottom: 0.5cm;
            left: 2cm;
            right: 2cm;
            font-size: 8pt;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 4pt;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>

<!-- CONTENT HERE -->

<footer>
    <span>Confidential — Talos Report</span>
    <span>Page <span class="page-number"></span></span>
</footer>
</body>
</html>"""

with open('/workspace/input.html', 'w', encoding='utf-8') as f:
    f.write(html_content)
```

### Step 2: Convert to PDF
```bash
wkhtmltopdf \
  --page-size A4 \
  --margin-top 0 \
  --margin-bottom 15mm \
  --margin-left 0 \
  --margin-right 0 \
  --print-media-type \
  --enable-local-file-access \
  --footer-right "[page] / [topage]" \
  --footer-font-size 8 \
  /workspace/input.html \
  /workspace/output.pdf
```

If `wkhtmltopdf` is not available, use this Python alternative:
```bash
pip install weasyprint -q
python3 -c "
import weasyprint
weasyprint.HTML(filename='/workspace/input.html').write_pdf('/workspace/output.pdf')
print('PDF generated')
"
```

---

## 3. ROUTE B: LaTeX → PDF (Academic/Math)

Best for: academic papers, papers with equations, formal reports with citations.

### Step 1: Generate .tex source
```python
tex_content = r"""
\documentclass[12pt, a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage[margin=2.5cm]{geometry}
\usepackage{setspace}
\usepackage{parskip}
\usepackage{xcolor}
\usepackage{fancyhdr}

% Header/footer
\pagestyle{fancy}
\fancyhf{}
\rhead{\thepage}
\lhead{Document Title}

\title{\textbf{Document Title}\\[0.5em]\large Subtitle here}
\author{Author Name}
\date{\today}

\begin{document}

\maketitle
\tableofcontents
\newpage

\section{Introduction}

Your introduction here. You can use math inline: $E = mc^2$ or display:

\begin{equation}
    \nabla \cdot \mathbf{E} = \frac{\rho}{\varepsilon_0}
\end{equation}

\section{Results}

\begin{table}[h]
\centering
\caption{Results table}
\begin{tabular}{lrr}
\toprule
Category & Value A & Value B \\
\midrule
Item 1 & 42 & 87.3\% \\
Item 2 & 156 & 91.2\% \\
\bottomrule
\end{tabular}
\end{table}

\section{Conclusion}

Your conclusions here.

\end{document}
"""

with open('/workspace/main.tex', 'w') as f:
    f.write(tex_content)
```

### Step 2: Compile (2 passes for references)
```bash
cd /workspace && pdflatex -interaction=nonstopmode main.tex && pdflatex -interaction=nonstopmode main.tex
```

If pdflatex not available:
```bash
pip install latex2pdf 2>/dev/null || echo "pdflatex not available"
# Alternative: use HTML route instead
```

---

## 4. ROUTE C: Process Existing PDF

```python
# Reading
import pdfplumber

with pdfplumber.open('/workspace/input.pdf') as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        tables = page.extract_tables()

# Merging/splitting
from pypdf import PdfWriter, PdfReader

reader = PdfReader('/workspace/input.pdf')
writer = PdfWriter()

# Add specific pages
for page_num in [0, 2, 4]:  # pages 1, 3, 5
    writer.add_page(reader.pages[page_num])

with open('/workspace/output.pdf', 'wb') as f:
    writer.write(f)
```

---

## 5. CHARTS IN HTML PDF

Use matplotlib to generate chart images, embed in HTML:
```python
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')  # non-interactive backend

fig, ax = plt.subplots(figsize=(8, 4), dpi=150)
ax.bar(categories, values, color='#2563eb')
ax.set_title('Revenue by Quarter', fontsize=14, fontweight='bold')
ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout()
plt.savefig('/workspace/chart.png', dpi=150, bbox_inches='tight')
plt.close()
```

In HTML:
```html
<img src="/workspace/chart.png" style="width: 100%; max-width: 600px; margin: 16pt 0;">
```

---

## 6. VALIDATION GATE

```python
import os
output_path = '/workspace/output.pdf'
size = os.path.getsize(output_path)
print(f"PDF size: {size} bytes")
assert size > 5000, f"PDF too small ({size} bytes) — generation likely failed"

# Verify it's a valid PDF
with open(output_path, 'rb') as f:
    header = f.read(5)
    assert header == b'%PDF-', f"File is not a valid PDF (header: {header})"

print("✅ PDF validation passed")
```

---

## 7. DELIVERY

```python
complete(
    text="Your PDF is ready!",
    attachments=["output.pdf"]
)
```

---

## 8. DESIGN PRINCIPLES FOR HTML PDFS

1. **Cover page**: full-bleed gradient background, white text, title + date
2. **Typography**: max 2 fonts — one for headings, one for body
3. **Color palette**: primary blue `#2563eb`, dark `#1e293b`, light `#f8fafc`
4. **Tables**: always use alternating row colors, hide gridlines
5. **White space**: generous margins, adequate line height (1.5-1.8)
6. **Page breaks**: use `page-break-after: always` between major sections
7. **Footers**: page numbers + document title

---

**REMEMBER: PDF is often the final deliverable. It must be perfect.**
