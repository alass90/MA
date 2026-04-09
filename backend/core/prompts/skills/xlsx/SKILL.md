# SKILL: Excel Spreadsheet Generation (XLSX)

You are now in **XLSX Builder mode**. Read every line before touching a single cell.

---

## 1. TOOL CHAIN (EXACT ORDER)

```
1. read_file("SKILL.md")              ← you are here
2. Analyze requirements — plan sheets, columns, formulas
3. Generate each sheet with openpyxl
4. Validation gate: verify formulas, references, data integrity
5. complete(attachments=[output.xlsx])
```

---

## 2. LIBRARY

Always use `openpyxl`. Do not use `xlwt`, `xlrd`, or `pandas.to_excel` alone.

```bash
pip install openpyxl -q
```

---

## 3. WORKBOOK SETUP

```python
from openpyxl import Workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, LineChart, PieChart, Reference

wb = Workbook()
ws = wb.active
ws.title = "Sheet1"

# Good practice: remove default sheet if creating custom ones
# wb.remove(wb.active)
```

---

## 4. STYLING RULES (MANDATORY)

### 4.1 Always Hide Gridlines
```python
ws.sheet_view.showGridLines = False
```

### 4.2 Header Row Pattern
```python
header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
header_font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

for col_num, header in enumerate(headers, 1):
    cell = ws.cell(row=1, column=col_num, value=header)
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = header_alignment
```

### 4.3 Zebra Striping (Data Rows)
```python
fill_even = PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid")  # light blue
fill_odd = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")   # white

for row_num, row_data in enumerate(data, 2):
    fill = fill_even if row_num % 2 == 0 else fill_odd
    for col_num, value in enumerate(row_data, 1):
        cell = ws.cell(row=row_num, column=col_num, value=value)
        cell.fill = fill
        cell.font = Font(name="Calibri", size=10)
        cell.alignment = Alignment(horizontal="left", vertical="center")
```

### 4.4 Column Width Auto-Sizing
```python
for col in ws.columns:
    max_length = 0
    col_letter = get_column_letter(col[0].column)
    for cell in col:
        try:
            max_length = max(max_length, len(str(cell.value or "")))
        except:
            pass
    ws.column_dimensions[col_letter].width = min(max_length + 4, 50)
```

### 4.5 Row Height
```python
ws.row_dimensions[1].height = 30  # header
for row in range(2, len(data) + 2):
    ws.row_dimensions[row].height = 20
```

---

## 5. FORMULA COMPATIBILITY RULES (CRITICAL)

### Use These (Compatible with Excel 2019 AND 365):
```
SUM, AVERAGE, COUNT, COUNTA, COUNTIF, COUNTIFS
SUMIF, SUMIFS
VLOOKUP, INDEX, MATCH
IF, IFS, AND, OR, NOT
IFERROR, IFNA
LEFT, RIGHT, MID, LEN, FIND, SUBSTITUTE, TRIM, UPPER, LOWER
TEXT, VALUE, DATE, YEAR, MONTH, DAY
MAX, MIN, LARGE, SMALL
ROUND, CEILING, FLOOR, ABS
```

### NEVER USE (Excel 2019 incompatible):
```
❌ XLOOKUP — use VLOOKUP or INDEX/MATCH instead
❌ FILTER — use manual filtering  
❌ UNIQUE — use manual deduplication
❌ SORT, SORTBY — use manual sort
❌ LAMBDA — not available in 2019
❌ SEQUENCE — not available in 2019
❌ DYNAMIC ARRAY FUNCTIONS — avoid entirely
```

### Formula Examples
```python
# VLOOKUP (safe)
ws['D2'] = '=VLOOKUP(A2,Sheet2!$A:$C,2,FALSE)'

# INDEX/MATCH (safe, more powerful than VLOOKUP)
ws['E2'] = '=INDEX(Sheet2!$B:$B,MATCH(A2,Sheet2!$A:$A,0))'

# Conditional sum
ws['F2'] = '=SUMIF($B:$B,B2,$C:$C)'

# Safe error handling
ws['G2'] = '=IFERROR(VLOOKUP(A2,Sheet2!$A:$C,2,FALSE),"Not Found")'
```

---

## 6. DATA TYPES (IMPORTANT)

```python
from datetime import date, datetime
from openpyxl.styles import numbers

# Dates — store as Python date objects, not strings
cell.value = date(2024, 1, 15)
cell.number_format = 'DD/MM/YYYY'

# Currency
cell.value = 1250.50
cell.number_format = '"$"#,##0.00'

# Percentage
cell.value = 0.85  # 85%
cell.number_format = '0.00%'

# Integer
cell.value = 42
cell.number_format = '#,##0'
```

---

## 7. CHARTS

```python
from openpyxl.chart import BarChart, Reference, LineChart, PieChart

# Bar chart
chart = BarChart()
chart.type = "col"
chart.title = "Monthly Revenue"
chart.y_axis.title = "Revenue ($)"
chart.x_axis.title = "Month"
chart.style = 10  # built-in style (1-48)

data = Reference(ws, min_col=2, min_row=1, max_col=2, max_row=13)
categories = Reference(ws, min_col=1, min_row=2, max_row=13)
chart.add_data(data, titles_from_data=True)
chart.set_categories(categories)
chart.shape = 4

ws.add_chart(chart, "E2")  # position: top-left cell
```

---

## 8. MULTIPLE SHEETS

```python
# Create named sheets
ws_summary = wb.create_sheet("Summary")  
ws_data = wb.create_sheet("Raw Data")
ws_charts = wb.create_sheet("Charts")

# Set tab colors
ws_summary.sheet_properties.tabColor = "2563EB"  # blue
ws_data.sheet_properties.tabColor = "16A34A"     # green

# Cross-sheet references work normally in formulas
ws_summary['B2'] = '=SUM(\'Raw Data\'!C:C)'
```

---

## 9. FREEZE PANES & FILTERS

```python
# Freeze first row + first column
ws.freeze_panes = 'B2'

# Freeze only header row
ws.freeze_panes = 'A2'

# Auto-filter on header row
ws.auto_filter.ref = f"A1:{get_column_letter(len(headers))}1"
```

---

## 10. PIVOT TABLES

openpyxl cannot create native Excel pivot tables. For pivot-like summaries:

```python
# Use Python to compute summary, then write to a dedicated sheet
import collections

summary = collections.defaultdict(float)
for row in data:
    category = row[0]
    value = row[2]
    summary[category] += value

ws_pivot = wb.create_sheet("Pivot Summary")
ws_pivot.cell(1, 1, "Category")
ws_pivot.cell(1, 2, "Total")
for i, (cat, total) in enumerate(sorted(summary.items()), 2):
    ws_pivot.cell(i, 1, cat)
    ws_pivot.cell(i, 2, total)
    ws_pivot.cell(i, 2).number_format = '"$"#,##0.00'
```

---

## 11. VALIDATION GATE (MANDATORY BEFORE DELIVERY)

```python
output_path = '/workspace/output.xlsx'
wb.save(output_path)

# Gate 1: file exists and has size
import os
size = os.path.getsize(output_path)
print(f"File size: {size} bytes")
assert size > 1000, "File too small — something went wrong"

# Gate 2: re-open and check
from openpyxl import load_workbook
wb_check = load_workbook(output_path)
for sheet_name in wb_check.sheetnames:
    ws_check = wb_check[sheet_name]
    print(f"Sheet '{sheet_name}': {ws_check.max_row} rows x {ws_check.max_column} cols")
    assert ws_check.max_row > 1, f"Sheet '{sheet_name}' has no data rows"

print("✅ Validation passed — file is ready")
```

**Deliver ONLY after validation passes.**

---

## 12. DELIVERY

```python
wb.save('/workspace/output.xlsx')
complete(
    text="Your Excel spreadsheet is ready!",
    attachments=["output.xlsx"]
)
```

---

## 13. COMMON PATTERNS

### Financial Dashboard
- Sheet 1: Summary (key KPIs, totals, charts)
- Sheet 2: Monthly data (raw numbers, auto-filter)
- Sheet 3: Charts
- Formulas: SUMIF, IFERROR, VLOOKUP for lookups
- Colors: navy header, alternating rows

### Data Report
- Sheet 1: Overview / executive summary
- Sheet 2: Full dataset with auto-filter
- Sheet 3: Aggregations / pivot summary

### Tracker (Projects, Tasks, etc.)
- Status column with color coding via conditional formatting
- Date columns formatted properly
- Progress bars using data bars

---

**REMEMBER: Every cell you write is judged. Build spreadsheets that impress.**
