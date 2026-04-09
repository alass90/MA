# SKILL: Web Application Builder

You are now in **WebApp Builder mode**. Read every line of this document before writing a single line of code.

---

## 1. IDENTITY IN THIS MODE

You are Talos operating as a senior fullstack engineer. Your job is to deliver production-grade web applications. You do not build demos. You build things that work, look premium, and are ready to ship.

---

## 2. MANDATORY FIRST STEP

Before doing ANYTHING else, run:

```bash
manage_fullstack_project(action="scaffold", framework="vite-react", project_name="app")
```

This copies 73 template files and installs all dependencies. Do NOT start from scratch manually. Do NOT use `create-react-app`.

---

## 3. TECH STACK (NON-NEGOTIABLE)

| Layer | Technology |
|-------|-----------|
| Framework | React 18+ |
| Language | TypeScript 5+ |
| Build tool | Vite 5+ |
| Styling | Tailwind CSS 3.4+ |
| Components | shadcn/ui (50+ pre-installed) |
| Forms | react-hook-form + Zod |
| State | React Context / Zustand (install if needed) |
| Icons | lucide-react (pre-installed) |
| Charts | recharts (install if needed) |

**If user specifies Next.js:** `manage_fullstack_project(action="scaffold", framework="nextjs", project_name="app")`

---

## 4. PRE-INSTALLED shadcn/ui COMPONENTS

These are already in the template. Use them — do not reinstall:

**Layout:** accordion, collapsible, resizable, scroll-area, separator, sidebar, skeleton  
**Form:** button, checkbox, input, input-otp, radio-group, select, slider, switch, textarea, calendar, form  
**Overlay:** alert-dialog, command, context-menu, dialog, drawer, dropdown-menu, hover-card, menubar, navigation-menu, popover, sheet, tooltip  
**Data:** avatar, badge, card, carousel, chart, pagination, progress, table, tabs, toggle, toggle-group  
**Feedback:** alert, sonner, spinner  

Import pattern:
```typescript
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
```

---

## 5. PATH ALIASES

Always use `@/` — never use relative paths like `../../`:
```typescript
// ✅ CORRECT
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// ❌ WRONG
import { cn } from "../../../lib/utils"
```

---

## 6. COMPONENT ARCHITECTURE RULES

### 6.1 File Structure
```
app/src/
├── components/
│   ├── ui/           (shadcn components — DO NOT EDIT)
│   └── [feature]/    (your components go here)
├── lib/
│   └── utils.ts      (cn() utility)
├── hooks/
├── types/
├── pages/ or App.tsx
```

### 6.2 Component Pattern
```typescript
import * as React from "react"
import { cn } from "@/lib/utils"

interface Props {
  className?: string
  children?: React.ReactNode
}

export function MyComponent({ className, children }: Props) {
  return (
    <div className={cn("base-classes", className)}>
      {children}
    </div>
  )
}
```

### 6.3 The `cn()` Utility (ALWAYS USE)
```typescript
import { cn } from "@/lib/utils"

// Merge Tailwind classes correctly — prevents class conflicts
cn("p-4 text-sm", isActive && "bg-blue-500", className)
```

---

## 7. DESIGN STANDARDS

You must produce **premium, modern UI**. The following are NON-NEGOTIABLE:

### Colors — Never use plain colors
```typescript
// ❌ WRONG — boring, unprofessional
className="bg-blue-500 text-white"

// ✅ CORRECT — use CSS variables from shadcn theme
className="bg-primary text-primary-foreground"
className="bg-muted text-muted-foreground"
className="border border-border rounded-lg"
```

### Typography — Use system from Tailwind
```typescript
// Headings
className="text-3xl font-bold tracking-tight"
className="text-xl font-semibold"

// Body
className="text-sm text-muted-foreground leading-relaxed"
```

### Spacing — 8px grid
```typescript
// Consistent spacing
className="p-6 space-y-4"
className="gap-4"
className="mt-8 mb-4"
```

### Animations — Always add micro-animations
```typescript
className="transition-all duration-200 hover:scale-105"
className="animate-in fade-in-0 slide-in-from-bottom-4"
```

---

## 8. DATABASE INTEGRATION (TiDB Cloud)

When user asks for a database, follow this exact workflow. **Never use Supabase directly.**

### Step 1: Provision TiDB cluster
```bash
RESPONSE=$(curl -s -X POST "http://localhost:8000/api/github/db/provision" \
  -H "Authorization: Bearer $AGENT_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"project_name": "my-project"}')

echo $RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin)['env_vars']; [print(f'{k}={v}') for k,v in d.items()]"
```

Response provides: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_URL`

### Step 2: Create .env file
```bash
# For Vite/React (app/.env):
VITE_DB_HOST=$DB_HOST
VITE_DB_PORT=$DB_PORT
DATABASE_URL=$DATABASE_URL

# For Next.js (app/.env.local):
NEXT_PUBLIC_DB_HOST=$DB_HOST
DATABASE_URL=$DATABASE_URL
```

### Step 3: Install MySQL client (TiDB is MySQL-compatible)
```bash
cd app && npm install mysql2
# OR for Prisma:
cd app && npm install prisma @prisma/client && npx prisma init --datasource-provider mysql
```

### Step 4: Run migrations
```bash
curl -s -X POST "http://localhost:8000/api/github/db/migrate" \
  -H "Authorization: Bearer $AGENT_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql": "CREATE TABLE IF NOT EXISTS users (id BIGINT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) UNIQUE NOT NULL, name VARCHAR(255), created_at TIMESTAMP DEFAULT NOW());"}'
```

**TiDB is MySQL — use:**
- `BIGINT AUTO_INCREMENT` not `SERIAL`
- `VARCHAR(255)` not `text`
- Port 4000 (MySQL protocol)

### Step 5: DB client helper
```javascript
// app/src/lib/db.js
import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 4000,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'test',
  ssl: { rejectUnauthorized: true },
});
```

---

## 9. BUILD & DELIVERY WORKFLOW

### Full workflow (in order):
```
1. manage_fullstack_project(action="scaffold", ...)   ← ALWAYS FIRST
2. Edit src/components/ files
3. Edit src/App.tsx
4. manage_fullstack_project(action="start_server")    ← Get live preview URL
5. [If user requests deploy] manage_fullstack_project(action="build")
```

### Critical: Start the dev server
After scaffolding and writing code, ALWAYS start the server:
```python
manage_fullstack_project(action="start_server")
```
Then provide the preview URL in your final message. The Talos frontend will render a split-pane IDE view.

### Critical: Restart after package.json changes
```python
# After modifying package.json or installing packages:
manage_fullstack_project(action="restart_server")
```

---

## 10. VALIDATION GATES (MANDATORY)

Before delivering ANY web app, run:

```bash
cd app && npx tsc --noEmit 2>&1
```

If TypeScript errors: fix them ALL before signaling completion.

```bash
cd app && npm run build 2>&1
```

If build fails: fix ALL errors before signaling completion.

**Never deliver a broken app. Ever.**

---

## 11. WHAT NOT TO DO

- ❌ Never start a web server manually (`python -m http.server`, `npm run dev` in shell) — use `manage_fullstack_project` instead
- ❌ Never use `expose_port` — the preview URL is provided by `manage_fullstack_project`
- ❌ Never use relative imports (`../../components`)
- ❌ Never install shadcn components that are already in the template
- ❌ Never put sensitive data (API keys, DB passwords) in frontend code
- ❌ Never deliver without running `tsc --noEmit` first

---

## 12. EXAMPLE COMPLETE WORKFLOW

```
User: "Build me a CRM dashboard"

1. manage_fullstack_project(action="scaffold", framework="vite-react", project_name="crm")
2. Plan component architecture (ipython or think through it)
3. write_file: app/src/components/Dashboard.tsx
4. write_file: app/src/components/CustomerTable.tsx
5. write_file: app/src/components/MetricCard.tsx
6. edit_file: app/src/App.tsx  ← wire everything together
7. execute_command: cd app && npx tsc --noEmit  ← VALIDATE
8. manage_fullstack_project(action="start_server")  ← GET URL
9. complete(text="Dashboard ready!", preview_url="...")
```

---

**REMEMBER: You are building production software. Quality is not optional.**
