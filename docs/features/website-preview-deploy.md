# Website Preview & Deploy Feature

**Feature ID:** `DEPLOY-001`
**Status:** ✅ Implemented
**Date:** March 15, 2026
**Version:** 1.0.0
**Author:** Development Team

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Configuration](#configuration)
4. [User Guide](#user-guide)
5. [Developer Guide](#developer-guide)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)
8. [Change Log](#change-log)

---

## Overview

### Purpose

The Website Preview & Deploy Feature allows Talos AI agents to create, preview, and deploy websites and web applications directly from the sandbox environment. This feature enables users to:

- **Preview** websites with temporary live URLs
- **Deploy** websites permanently to Vercel
- **Deploy fullstack** applications with Supabase databases

### Key Benefits

- ✅ **Instant Previews**: See AI-generated websites live in seconds
- ✅ **One-Click Deploy**: Permanent hosting on Vercel with one command
- ✅ **Database Integration**: Automatic Supabase provisioning
- ✅ **Framework Agnostic**: Supports Next.js, Vite, Static, and more
- ✅ **Beautiful UI**: Modern preview panel with code/files/settings tabs

---

## Architecture

### System Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │ "Create a website"
       ▼
┌─────────────────────────────────────┐
│      Talos AI Agent                 │
│  - Creates files with sb_files_tool │
│  - Calls deploy_app tool            │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Backend: talos_deploy_tool.py     │
│  ┌────────────────────────────────┐ │
│  │ Level 1: Preview (Daytona)     │ │
│  │ Level 2: Deploy (Vercel)       │ │
│  │ Level 3: Fullstack (V+S)       │ │
│  └────────────────────────────────┘ │
└──────┬──────────────────────────────┘
       │ Returns ToolResult with URL
       ▼
┌─────────────────────────────────────┐
│   Frontend: Message Stream          │
│  ┌────────────────────────────────┐ │
│  │ useDeploymentDetector hook     │ │
│  │ Parses tool result             │ │
│  │ Opens WebsitePreviewPanel      │ │
│  └────────────────────────────────┘ │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   User sees live preview!           │
│  - Iframe with website              │
│  - Code/Files/DB/Settings tabs      │
│  - Publish button                   │
└─────────────────────────────────────┘
```

### Component Stack

#### Backend
```
backend/core/tools/
├── talos_deploy_tool.py       # Main deploy tool
└── tool_registry.py            # Tool registration

backend/core/sandbox/
└── api.py                      # Sandbox file APIs
```

#### Frontend
```
frontend/src/
├── components/thread/
│   ├── website-preview-panel.tsx  # Main UI component
│   └── ThreadComponent.tsx        # Integration point
├── stores/
│   └── use-preview-panel-store.ts # Global state
├── hooks/
│   └── use-deployment-detector.ts # Auto-detection
└── app/api/sandbox/
    ├── [sandboxId]/files/route.ts # Files list API
    └── [sandboxId]/file/route.ts  # File content API
```

---

## Configuration

### Required Environment Variables

#### Backend (`.env`)

```bash
##### DEPLOYMENT FEATURE (Optional; for Website Preview & Deploy)

# Vercel API token for permanent deployments (action="deploy")
# Get from: https://vercel.com/account/tokens
VERCEL_TOKEN=your_vercel_token_here

# Supabase Service Token for fullstack deployments (action="fullstack")
# Get from: https://supabase.com/dashboard/account/tokens
SUPABASE_SERVICE_TOKEN=your_supabase_service_token_here

# GitHub Personal Access Token for repository creation (optional)
# Get from: https://github.com/settings/tokens
# Required scopes: repo, workflow
GITHUB_TOKEN=your_github_token_here
```

### How to Get Tokens

#### 1. Vercel Token

1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Name: "Talos Deploy"
4. Scope: Select your account/team
5. Expiration: No expiration (or custom)
6. Click "Create"
7. Copy token and paste in `.env` as `VERCEL_TOKEN=...`

#### 2. Supabase Service Token

1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate new token"
3. Name: "Talos Fullstack Deploy"
4. Click "Generate token"
5. Copy token and paste in `.env` as `SUPABASE_SERVICE_TOKEN=...`

#### 3. GitHub Token (Optional)

1. Go to https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Name: "Talos Deploy"
4. Scopes: Check `repo` and `workflow`
5. Click "Generate token"
6. Copy token and paste in `.env` as `GITHUB_TOKEN=...`

---

## User Guide

### How to Use

#### 1. Create & Preview a Website

**Chat with Talos:**
```
Create a modern landing page for a SaaS product and preview it
```

**What happens:**
1. ✅ Agent creates HTML/CSS/JS files
2. ✅ Agent calls `deploy_app(action="preview")`
3. ✅ Preview panel opens automatically
4. ✅ You see the live website in an iframe

#### 2. Deploy Permanently to Vercel

**In the Preview Panel:**
1. Click the **"Publish"** button
2. Wait for deployment (30-60 seconds)
3. Get permanent `your-site.vercel.app` URL

**Or via Chat:**
```
Deploy this website permanently to Vercel
```

#### 3. Deploy Fullstack with Database

**Chat with Talos:**
```
Create a todo app with Supabase database and deploy it
```

**What happens:**
1. ✅ Agent creates app files + SQL schema
2. ✅ Agent calls `deploy_app(action="fullstack")`
3. ✅ Vercel deployment + Supabase project created
4. ✅ Database migrations run automatically
5. ✅ Environment variables configured

### Preview Panel Features

#### Tabs

1. **Preview Tab**
   - Live iframe preview
   - Desktop/Mobile viewport toggle
   - Refresh, Open in new tab, Fullscreen

2. **Code Tab**
   - Syntax-highlighted code viewer
   - Line numbers
   - File path display

3. **Files Tab**
   - Interactive file tree
   - Expand/collapse folders
   - File sizes

4. **Database Tab**
   - Connection status
   - Table list
   - Row counts

5. **Settings Tab**
   - Framework info
   - Build commands
   - Domain settings

#### Actions

- **Theme Toggle**: Switch between dark/light mode
- **GitHub**: (Coming soon) Push to GitHub repo
- **Share**: (Coming soon) Share preview with others
- **Publish**: Deploy permanently to Vercel
- **More Menu**: Download ZIP, Version history

---

## Developer Guide

### Adding the Deploy Tool to an Agent

The deploy tool is automatically available to all agents. No configuration needed!

**Agent will automatically use it when user asks for:**
- "preview this"
- "deploy this"
- "create a website"
- "make a landing page"

### Manual Tool Call

```python
# In backend code or agent logic
result = await deploy_app(
    action="preview",  # or "deploy" or "fullstack"
    project_path="/home/daytona/my-app",
    name="my-awesome-site",  # Optional
    framework="nextjs",  # Optional - auto-detected
    env_vars={"API_KEY": "secret"},  # Optional
    db_schema="/path/to/schema.sql"  # For fullstack only
)

# Result
{
    "success": True,
    "url": "https://preview.daytona.io/abc123",
    "project_name": "my-awesome-site",
    "framework": "nextjs",
    "level": "preview"
}
```

### Supported Frameworks

| Framework | Auto-Detection | Build Command | Port |
|-----------|---------------|---------------|------|
| Next.js | `package.json` has `next` | `npm run dev` | 3000 |
| Vite | `package.json` has `vite` | `npm run dev` | 5173 |
| React CRA | `react-scripts` | `npm start` | 3000 |
| Static HTML | `index.html` exists | `python -m http.server` | 8000 |
| Svelte | `svelte` | `npm run dev` | 5173 |
| Nuxt.js | `nuxt` | `npm run dev` | 3000 |
| Astro | `astro` | `npm run dev` | 4321 |
| Remix | `@remix-run` | `npm run dev` | 3000 |
| Flask | `app.py` + `Flask` | `flask run` | 5000 |
| FastAPI | `main.py` + `FastAPI` | `uvicorn main:app` | 8000 |

### Extending with New Frameworks

Edit `backend/core/tools/talos_deploy_tool.py`:

```python
# Add to FRAMEWORK_DETECTION dict
FRAMEWORK_DETECTION = {
    "your-framework": {
        "detect": lambda files: "your-framework.config.js" in files,
        "install": "npm install",
        "dev": "npm run dev",
        "port": 3000
    }
}
```

---

## API Reference

### Backend Tool: `deploy_app`

#### Tool Name
`deploy_app`

#### Description
Deploy websites and web applications from the sandbox to live URLs.

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | `"preview"` \| `"deploy"` \| `"fullstack"` | ✅ Yes | Deployment level |
| `project_path` | `string` | ✅ Yes | Path in sandbox (e.g., `/home/daytona/my-app`) |
| `name` | `string` | ❌ No | Project name (auto-generated if omitted) |
| `framework` | `string` | ❌ No | Override auto-detection |
| `env_vars` | `object` | ❌ No | Environment variables `{ "KEY": "value" }` |
| `db_schema` | `string` | ❌ No | Path to SQL schema (fullstack only) |

#### Return Value

```typescript
{
  success: boolean;
  level: "preview" | "vercel" | "fullstack";
  url: string;
  project_name?: string;
  framework?: string;
  deployment_id?: string;
  database_url?: string;
  database_provider?: string;
  message: string;
  formatted_message: string;
}
```

#### Examples

**Preview:**
```json
{
  "action": "preview",
  "project_path": "/home/daytona/portfolio"
}
```

**Deploy:**
```json
{
  "action": "deploy",
  "project_path": "/home/daytona/saas-app",
  "name": "my-saas",
  "env_vars": {
    "STRIPE_KEY": "sk_test_..."
  }
}
```

**Fullstack:**
```json
{
  "action": "fullstack",
  "project_path": "/home/daytona/todo-app",
  "name": "todo",
  "db_schema": "/home/daytona/todo-app/schema.sql"
}
```

### Frontend Component: `WebsitePreviewPanel`

#### Props

```typescript
interface WebsitePreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  previewUrl?: string;
  projectPath?: string;
  framework?: string;
  deploymentId?: string;
  projectName?: string;
  databaseUrl?: string;
  databaseProvider?: string;
  threadId?: string;
  projectId?: string;
  onPublish?: () => Promise<void>;
}
```

#### Usage

```tsx
import { WebsitePreviewPanel } from '@/components/thread/website-preview-panel';

<WebsitePreviewPanel
  isOpen={true}
  onClose={() => console.log('Closed')}
  previewUrl="https://preview.daytona.io/abc123"
  projectPath="/home/daytona/my-app"
  framework="nextjs"
  projectName="my-app"
  onPublish={async () => {
    // Deploy to Vercel
  }}
/>
```

### Frontend Hook: `useDeploymentDetector`

#### Usage

```tsx
import { useDeploymentDetector } from '@/hooks/use-deployment-detector';

// In component
useDeploymentDetector(messages, projectId);
```

#### How it Works

1. Monitors message stream for `deploy_app` tool results
2. Parses JSON output from tool
3. Extracts deployment info (URL, framework, etc.)
4. Calls `openPanel()` in Zustand store
5. Preview panel opens automatically

---

## Troubleshooting

### Preview Not Opening

**Problem:** Preview panel doesn't open after deployment

**Solutions:**
1. Check browser console for errors
2. Verify tool result contains `"success": true`
3. Check Network tab for API calls
4. Refresh page and try again

### Vercel Deploy Fails

**Problem:** `deploy_app(action="deploy")` returns error

**Solutions:**
1. ✅ Check `VERCEL_TOKEN` is set in `.env`
2. ✅ Verify token has correct permissions
3. ✅ Check Vercel account has available deployments
4. ✅ Look at backend logs for detailed error

**Common Errors:**
```
"VERCEL_TOKEN not configured"
→ Add token to backend/.env

"Invalid token"
→ Regenerate token at vercel.com

"Deployment limit reached"
→ Upgrade Vercel plan or delete old deployments
```

### Fullstack Deploy Fails

**Problem:** `deploy_app(action="fullstack")` returns error

**Solutions:**
1. ✅ Check both `VERCEL_TOKEN` and `SUPABASE_SERVICE_TOKEN` are set
2. ✅ Verify SQL schema file exists
3. ✅ Check Supabase account has project quota
4. ✅ Validate SQL syntax in schema

**Common Errors:**
```
"SUPABASE_SERVICE_TOKEN required"
→ Add token to backend/.env

"Failed to create Supabase project"
→ Check project quota in Supabase dashboard

"Migration failed"
→ Validate SQL syntax
```

### Preview URL Not Loading

**Problem:** Preview URL returns 404 or blank page

**Solutions:**
1. ✅ Wait 10-15 seconds for dev server to start
2. ✅ Check sandbox logs for errors
3. ✅ Verify framework was detected correctly
4. ✅ Check port is not blocked

**Debug:**
```bash
# In sandbox terminal
ps aux | grep node  # Check if dev server is running
curl localhost:3000  # Test locally first
```

---

## Change Log

### Version 1.0.0 (March 15, 2026)

#### ✅ Added
- Initial implementation of Website Preview & Deploy feature
- Backend `talos_deploy_tool.py` with 3 deployment levels
- Frontend `WebsitePreviewPanel` component
- Auto-detection hook `useDeploymentDetector`
- Zustand store for preview panel state
- API routes for sandbox files
- Support for 10+ frameworks
- Dark/Light theme toggle
- Desktop/Mobile viewport toggle
- Documentation and setup guides

#### 🔧 Configuration
- Added `VERCEL_TOKEN` to `.env`
- Added `SUPABASE_SERVICE_TOKEN` to `.env`
- Added `GITHUB_TOKEN` to `.env`

#### 📚 Documentation
- Created `website-preview-deploy.md`
- Created `DEPLOYMENT_FEATURE_IMPLEMENTATION.md`
- Updated `.env.example` files

---

## Future Enhancements

### Planned Features (v1.1)

- [ ] Real file tree from sandbox
- [ ] In-panel code editor
- [ ] Database query UI
- [ ] Deployment history & rollback
- [ ] GitHub push integration
- [ ] Custom domain configuration
- [ ] Analytics dashboard
- [ ] A/B testing support

### Requested Features

Submit feature requests at: [GitHub Issues](https://github.com/your-repo/issues)

---

## Support

**Documentation:** See this file
**Issues:** [GitHub Issues](https://github.com/your-repo/issues)
**Community:** [Discord](https://discord.gg/your-server)

---

**Last Updated:** March 15, 2026
**Maintained By:** Talos Development Team
**License:** [Your License]
