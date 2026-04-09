# SKILL: Word Document Generation (DOCX)

You are now in **DOCX Builder mode**. Read every line before generating.

---

## 1. TOOL CHAIN (EXACT ORDER — DO NOT DEVIATE)

```
1. read_file("SKILL.md")              ← you are here
2. Analyze requirements & plan structure
3. Generate document via Python (python-docx)
4. execute_command: validate output
5. upload_file (if user requests sharing)
6. complete(attachments=[output.docx])
```

---

## 2. LIBRARY & ENVIRONMENT

Use `python-docx`. It is available in the sandbox. If not installed:
```bash
pip install python-docx -q
```

**NEVER use:**
- `docxtpl` unless user asks for templates
- LibreOffice for creation (use it only for conversion to PDF if needed)
- Manual XML manipulation

---

## 3. DOCUMENT STRUCTURE RULES

### 3.1 Styles Hierarchy
```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title — one per document
title = doc.add_heading('Document Title', level=0)

# Section headings
doc.add_heading('Section Name', level=1)
doc.add_heading('Subsection Name', level=2)

# Body text — always use paragraphs
p = doc.add_paragraph('Content goes here.')

# Bold/italic inline
run = p.add_run('important term')
run.bold = True
```

### 3.2 Page Setup (Always Configure)
```python
from docx.shared import Inches
from docx.oxml.ns import qn

section = doc.sections[0]
section.page_height = Inches(11)
section.page_width = Inches(8.5)
section.left_margin = Inches(1)
section.right_margin = Inches(1)
section.top_margin = Inches(1)
section.bottom_margin = Inches(1)
```

---

## 4. TABLES

```python
# Always specify column widths
table = doc.add_table(rows=1, cols=3)
table.style = 'Table Grid'

# Header row
hdr_cells = table.rows[0].cells
hdr_cells[0].text = 'Column 1'
hdr_cells[1].text = 'Column 2'
hdr_cells[2].text = 'Column 3'

# Style header
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
for cell in hdr_cells:
    cell._tc.get_or_add_tcPr().append(
        parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="2563EB"/>')
    )
    for para in cell.paragraphs:
        run = para.runs[0] if para.runs else para.add_run(cell.text)
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        run.bold = True

# Data rows
for row_data in data:
    row_cells = table.add_row().cells
    for i, value in enumerate(row_data):
        row_cells[i].text = str(value)
```

---

## 5. IMAGES

```python
# Add image (must be a real file path)
doc.add_picture('/workspace/image.png', width=Inches(4))

# Add caption below
caption = doc.add_paragraph('Figure 1: Description')
caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
caption.style = 'Caption'
```

If images need to be downloaded first:
```bash
wget "URL" -O /workspace/image.png
```

---

## 6. LISTS

```python
# Bullet list
doc.add_paragraph('Item one', style='List Bullet')
doc.add_paragraph('Item two', style='List Bullet')
doc.add_paragraph('Item three', style='List Bullet')

# Numbered list
doc.add_paragraph('First step', style='List Number')
doc.add_paragraph('Second step', style='List Number')
```

---

## 7. PROFESSIONAL TYPOGRAPHY

```python
from docx.shared import Pt

# Set font for normal style globally
style = doc.styles['Normal']
font = style.font
font.name = 'Calibri'
font.size = Pt(11)
font.color.rgb = RGBColor(0x1F, 0x2937, 0x4E)  # dark navy

# Heading styles
h1_style = doc.styles['Heading 1']
h1_style.font.size = Pt(18)
h1_style.font.bold = True
h1_style.font.color.rgb = RGBColor(0x16, 0x45, 0x8B)  # deep blue
```

---

## 8. SAVE & VALIDATE

```python
output_path = '/workspace/output.docx'
doc.save(output_path)

# Verify file was created
import os
size = os.path.getsize(output_path)
print(f"Document saved: {output_path} ({size} bytes)")
assert size > 0, "Document is empty — generation failed"
```

**CHECK BEFORE DELIVERY:**
- [ ] File exists and size > 0
- [ ] Document opens without error (test with `python-docx` re-read)
- [ ] All sections are present
- [ ] Tables have correct number of columns/rows
- [ ] Images rendered (if applicable)

```python
# Re-read validation
from docx import Document as DocxReader
test_doc = DocxReader(output_path)
para_count = len(test_doc.paragraphs)
print(f"Validation: {para_count} paragraphs found")
assert para_count > 0, "Document appears empty"
```

---

## 9. PDF CONVERSION (IF REQUESTED)

```bash
# Convert docx to pdf using LibreOffice
libreoffice --headless --convert-to pdf /workspace/output.docx --outdir /workspace/
```

---

## 10. DELIVERY

```python
# Always attach the file
complete(
    text="Your Word document is ready!",
    attachments=["output.docx"]
)
```

If user wants to share:
```python
upload_file(file_path="output.docx")
# Returns a secure URL — include in your message
```

---

## 11. DOCUMENT TYPES & TEMPLATES

### Business Report
- Cover page with title, date, author
- Executive summary (1 page)
- Sections with numbered headings
- Data tables with professional styling
- Conclusions

### Technical Documentation
- Table of contents
- Code blocks (use `Courier New` monospace font)
- Numbered sections (1.1, 1.2, etc.)
- Diagrams with captions

### Proposal
- Company header
- Problem statement
- Proposed solution
- Timeline table
- Pricing table
- Terms & signature block

---

**REMEMBER: Document quality reflects Talos quality. Never deliver a mediocre document.**
