# Talos — Architecture Codebase

**Date**: 2026-03-15
**Version**: Fork of Suna/Kortix (Apache 2.0)
**Stack**: Next.js + FastAPI + Redis + Supabase + Daytona

---

## 1. Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (Next.js)                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ Chat UI      │─────▶│ WebSocket    │◀────▶│ Supabase     │ │
│  │ ThreadComp   │      │ Realtime     │      │ Messages     │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTP API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (FastAPI) - api.py                                     │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ /api/run     │─────▶│ Dramatiq     │─────▶│ Redis Queue  │ │
│  │              │      │ (worker)     │      │              │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ run_agent_background.py
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Worker Process                                                 │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ run_agent()  │─────▶│ LLM Call     │◀────▶│ Tools        │ │
│  │ (core/run.py)│      │ (Dashscope)  │      │ (sandbox)    │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Response streaming
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Redis Pub/Sub + Supabase                                       │
│  ┌──────────────┐      ┌──────────────┐                        │
│  │ agent_run:ID │─────▶│ messages     │────▶ Frontend          │
│  │ :responses   │      │ INSERT       │      (realtime)        │
│  └──────────────┘      └──────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Tool execution
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Daytona Sandbox                                                │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐ │
│  │ /workspace   │─────▶│ sb_files_tool│─────▶│ Preview URL  │ │
│  │              │      │ sb_shell_tool│      │ (port 8080)  │ │
│  └──────────────┘      └──────────────┘      └──────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend

### 2.1 Fichiers clés

| Fichier | Lignes | Rôle Principal | Points d'entrée |
|---------|--------|----------------|-----------------|
| `api.py` | ~300 | FastAPI app, routes HTTP | `POST /api/chat/run` |
| `run_agent_background.py` | 729 | Dramatiq worker, async job | `@dramatiq.actor run_agent_background()` |
| `core/run.py` | 1064 | Orchestration agent | `run_agent()` generator |
| `core/agentpress/response_processor.py` | 2191 | Traitement streaming LLM | `process_response()` |
| `core/agentpress/thread_manager.py` | 865 | Gestion messages DB | `add_message()` |
| `core/agentpress/context_manager.py` | 1286 | Construction du contexte LLM | `build_context()` |
| `core/tools/sb_files_tool.py` | 718 | Manipulation fichiers sandbox | `create_file()`, `_trigger_auto_deploy()` (ligne 687) |
| `core/tools/talos_deploy_tool.py` | 939 | Déploiement preview | `deploy_app()` (ligne 852) |
| `core/suna_config.py` | 49 | Config agent par défaut | `SUNA_CONFIG` dict |

### 2.2 Flux d'exécution d'un agent

```python
1. Frontend POST /api/chat/run
   ├─ backend/api.py:core_api.run_agent()
   │
2. Enqueue Dramatiq job
   ├─ run_agent_background.send(agent_run_id, thread_id, ...)
   │
3. Worker process (run_agent_background.py)
   ├─ initialize() → warm cache, Redis, DB
   ├─ acquire_run_lock() → éviter duplicate
   ├─ load_agent_config() → from cache or DB
   ├─ call run_agent() → generator
   │
4. Agent loop (core/run.py)
   ├─ ToolManager.register_all_tools()
   ├─ while True:
   │   ├─ build_context() → messages history
   │   ├─ LLM call (via litellm/dashscope)
   │   ├─ ResponseProcessor.process()
   │   │   ├─ yield status messages
   │   │   ├─ execute tools (parallel/sequential)
   │   │   └─ detect termination (complete/ask)
   │   └─ break if done
   │
5. Response streaming
   ├─ Redis: rpush(agent_run:ID:responses, json)
   ├─ Redis: publish(agent_run:ID:new_response, "new")
   ├─ Supabase: INSERT into messages (type='tool', metadata={...})
   │
6. Cleanup
   └─ update agent_run status, TTL keys, close pubsub
```

### 2.3 WebSocket / Streaming

**Pas de WebSocket direct** - utilise **Supabase Realtime** :

1. **Backend → Supabase** :
   ```python
   # thread_manager.py:add_message()
   await client.table('messages').insert({
       'thread_id': thread_id,
       'type': 'tool',  # ou 'status', 'assistant'
       'content': {...},
       'metadata': {...}  # JSON string
   }).execute()
   ```

2. **Frontend écoute** :
   - Via Supabase Realtime subscription
   - Hook `use-deployment-detector.ts` parse metadata
   - Ouvre `website-preview-panel.tsx` si deploy détecté

**Types d'events** (dans `type` field):
- `status`: agent state (running, completed, failed)
- `tool`: tool call/result
- `assistant`: LLM response
- `llm_response_end`: billing data

### 2.4 Sandbox Daytona

**Interaction** :
```python
# Initialisation sandbox (tool_base.py)
from daytona_sdk import Daytona
sandbox = await Daytona.create(api_key=..., workspace_id=project_id)

# Opérations fichiers
await sandbox.fs.upload_file(content.encode(), "/workspace/index.html")
await sandbox.fs.download_file("/workspace/package.json")

# URL preview
preview_link = await sandbox.get_preview_link(8080)
# → Returns: https://8080-xxx.daytonaproxy01.net
```

**Tools disponibles** :
- `sb_files_tool`: create/edit/delete files
- `sb_shell_tool`: execute shell commands
- `sb_expose_tool`: expose ports
- `sb_vision_tool`, `sb_image_edit_tool`: AI vision
- `sb_docs_tool`, `sb_presentation_tool`: documents
- **`talos_deploy_tool`** (nouveau): auto-deploy

---

## 3. Frontend

### 3.1 Fichiers clés

| Fichier | Rôle | Composants principaux |
|---------|------|----------------------|
| `components/thread/ThreadComponent.tsx` | Container chat + thread | `<Thread />`, gère state messages |
| `components/thread/content/ThreadContent.tsx` | Rendu messages | Affiche messages, tool calls |
| `components/thread/chat-input/chat-input.tsx` | Input utilisateur | Form, file upload |
| `hooks/use-deployment-detector.ts` | Détection deploy | Parse metadata, trigger panel |
| `components/thread/website-preview-panel.tsx` | Panel preview site | Iframe, tabs (preview/code/files) |
| `stores/use-preview-panel-store.ts` | State preview panel | Zustand store (open/close) |
| `app/(dashboard)/agents/[threadId]/page.tsx` | Page thread agent | Route `/agents/:threadId` |

### 3.2 Flux UI - Computer Panel

**État actuel** :
```tsx
// Computer panel s'ouvre automatiquement pour toutes les actions
<ComputerPanel>
  {/* Affiche : fichiers créés, commandes, outputs, etc. */}
</ComputerPanel>
```

**Ce qui existe déjà** :
- `website-preview-panel.tsx` : panel dédié preview ✅
- `use-deployment-detector.ts` : détection auto deploy ✅
- `use-preview-panel-store.ts` : state management ✅

**Ce qui manque** :
- **Auto-close Computer panel** quand deploy détecté
- **Auto-open Preview panel** à la place
- Switch logique entre les 2 panels

### 3.3 Composants critiques

#### Computer Panel (sidebar actuel)
```
Localisation : components/sidebar/ ou components/thread/
Fonction : Affiche toutes les actions de l'agent en temps réel
État : S'ouvre par défaut, reste ouvert
```

#### Website Preview Panel
```tsx
// website-preview-panel.tsx:87-100
interface WebsitePreviewPanelProps {
  isOpen: boolean;           // Contrôlé par store
  onClose: () => void;
  previewUrl?: string;       // URL Daytona
  projectPath?: string;
  framework?: string;
  deploymentId?: string;
  // ...
}

// Usage:
<WebsitePreviewPanel
  isOpen={isPreviewOpen}
  previewUrl={deploymentUrl}
  onClose={() => closePreview()}
/>
```

#### Deployment Detector
```ts
// use-deployment-detector.ts:14-72
export function useDeploymentDetector(messages) {
  useEffect(() => {
    // Parse metadata de chaque message
    const parsedMetadata = JSON.parse(message.metadata);

    // Cherche tool_call_metadata.name === 'deploy_app'
    if (toolCallData.name === 'deploy_app') {
      const output = JSON.parse(toolResult.output);

      // Ouvre preview panel
      openPreviewPanel({
        url: output.url,
        deploymentId: output.deployment_id,
        // ...
      });
    }
  }, [messages]);
}
```

---

## 4. Points d'extension identifiés

### 4.1 Backend - Auto-deploy trigger

**Fichier** : `backend/core/tools/sb_files_tool.py`

**Ligne 141-144** : Hook auto-deploy existant
```python
# Auto-deploy detection: Check if this is a deployable web project
should_auto_deploy = await self._should_auto_deploy(file_path, full_path)

if should_auto_deploy:
    await self._trigger_auto_deploy(file_path)
```

**Ligne 687-719** : Implémentation trigger
```python
async def _trigger_auto_deploy(self, file_path: str):
    """Trigger automatic preview deployment."""
    from core.tools.talos_deploy_tool import TalosDeployTool

    deploy_tool = TalosDeployTool(
        project_id=self.project_id,
        thread_manager=self.thread_manager
    )

    result = await deploy_tool.deploy_app(
        action="preview",
        project_path=self.workspace_path,
        framework=None  # Auto-detect
    )
```

**Détection** : `index.html`, `package.json`, `app.py`, `main.py`, configs frameworks

### 4.2 Backend - Message metadata

**Fichier** : `backend/core/agentpress/thread_manager.py`

**Ligne 78-120** : Insertion message Supabase
```python
async def add_message(
    self,
    thread_id: str,
    type: str,
    content: Union[Dict, List, str],
    metadata: Optional[Dict[str, Any]] = None,
    # ...
):
    data_to_insert = {
        'thread_id': thread_id,
        'type': type,
        'content': content,
        'metadata': metadata or {},  # ← metadata ici
    }

    result = await client.table('messages').insert(data_to_insert).execute()
```

**Point d'injection** : Ajouter un flag `auto_preview_triggered: true` dans metadata pour signaler au frontend

### 4.3 Frontend - Detection & Panel Switch

**Fichier** : `frontend/src/hooks/use-deployment-detector.ts`

**Ligne 14-72** : Boucle détection
```ts
for (let i = messages.length - 1; i >= 0; i--) {
  const parsedMetadata = JSON.parse(message.metadata);

  if (message.type === 'tool' && parsedMetadata?.tool_call_metadata) {
    if (toolCallData.name === 'deploy_app') {
      // ✅ Ici : ajouter closeComputerPanel()
      openPreviewPanel({...});
      break;
    }
  }
}
```

**Point d'extension** :
1. Importer fonction `closeComputerPanel()` depuis store Computer
2. Appeler avant `openPreviewPanel()`

### 4.4 Frontend - Computer Panel Store

**À localiser** : Store Zustand pour Computer panel

**Recherche nécessaire** :
```bash
grep -r "useComputerPanel\|computerPanelStore" frontend/src
grep -r "isComputerOpen\|setComputerOpen" frontend/src
```

**Action requise** :
- Trouver le store Computer panel
- Exposer `closePanel()` ou `setOpen(false)`
- Utiliser dans `use-deployment-detector.ts`

---

## 5. Architecture déploiement (feature récente)

### 5.1 Flow complet

```
1. Agent crée index.html
   ↓
2. sb_files_tool.create_file()
   ├─ _should_auto_deploy() → True
   ├─ _trigger_auto_deploy()
   │   └─ TalosDeployTool.deploy_app(action="preview")
   │       ├─ Daytona.get_preview_link(8080)
   │       └─ Returns DeployResult(url="https://...")
   ↓
3. Tool result → ThreadManager.add_message()
   ├─ type='tool'
   ├─ metadata={
   │     tool_call_metadata: {name: 'deploy_app'},
   │     tool_result_metadata: {output: {url: '...', deployment_id: '...'}}
   │  }
   └─ INSERT into Supabase messages table
   ↓
4. Supabase Realtime → Frontend
   ↓
5. use-deployment-detector hook
   ├─ Parse metadata
   ├─ Detect deploy_app tool
   └─ openPreviewPanel(url, deploymentId, ...)
   ↓
6. WebsitePreviewPanel s'affiche
   └─ <iframe src={previewUrl} />
```

### 5.2 Fichiers modifiés (session actuelle)

**Backend** :
- `backend/core/tools/sb_files_tool.py` : ajout `_should_auto_deploy()`, `_trigger_auto_deploy()`
- `backend/core/tools/talos_deploy_tool.py` : création complète (939 lignes)
- `backend/core/tools/tool_registry.py` : ajout `talos_deploy_tool` dans registry

**Frontend** :
- `frontend/src/hooks/use-deployment-detector.ts` : création (détection deploy)
- `frontend/src/components/thread/website-preview-panel.tsx` : création (panel preview)
- `frontend/src/stores/use-preview-panel-store.ts` : création (Zustand store)
- `frontend/src/app/api/sandbox/[sandboxId]/file/route.ts` : fix Next.js 15 params
- `frontend/src/app/api/sandbox/[sandboxId]/files/route.ts` : fix Next.js 15 params

**Docker** :
- `docker-compose.yaml` : timeout augmenté, memory limit 6G frontend
- `frontend/Dockerfile` : NODE_OPTIONS max-old-space-size=4096

---

## 6. Ce qui n'est pas encore compris

### 6.1 Frontend

- [ ] **Localisation exacte du Computer Panel** :
  - Quel composant rend la sidebar droite ?
  - Quel store gère son état (open/close) ?
  - Comment il s'ouvre automatiquement ?

- [ ] **Flux Supabase Realtime** :
  - Quel hook frontend subscribe aux messages ?
  - Où est le client Supabase initialisé ?
  - Comment les messages sont streamés en temps réel ?

- [ ] **Routing des panels** :
  - Y a-t-il un layout manager pour les sidebars ?
  - Les panels sont-ils mutuellement exclusifs ?

### 6.2 Backend

- [ ] **Prompt engineering** :
  - Contenu exact de `SYSTEM_PROMPT` (core/prompts/prompt.py)
  - Instructions données à l'agent concernant les tools

- [ ] **MCP Tools** :
  - Comment les MCP custom sont chargés ?
  - Où est `MCPToolWrapper` utilisé ?

- [ ] **Billing** :
  - Logique de credits dans `billing_integration`
  - Comment les tool calls sont facturés ?

### 6.3 Sandbox

- [ ] **Port forwarding** :
  - Comment Daytona expose les ports ?
  - Peut-on exposer plusieurs ports simultanément ?

- [ ] **Lifecycle** :
  - Quand les sandboxes sont détruits ?
  - Peut-on réutiliser un sandbox entre threads ?

---

## 7. Prochaines étapes recommandées

### Pour implémenter "auto-close Computer, auto-open Preview"

1. **Localiser Computer Panel store** :
   ```bash
   grep -r "Computer.*store\|useComputer\|SidebarStore" frontend/src
   ```

2. **Modifier `use-deployment-detector.ts`** :
   ```ts
   import { useComputerPanelStore } from '@/stores/use-computer-panel-store';

   const { setOpen: setComputerOpen } = useComputerPanelStore();

   // Avant openPreviewPanel()
   setComputerOpen(false);  // Ferme Computer
   openPreviewPanel({...}); // Ouvre Preview
   ```

3. **Tester le flow** :
   - Créer thread
   - Demander "create a landing page"
   - Vérifier : Computer se ferme, Preview s'ouvre

4. **Gérer les cas limites** :
   - Si user ré-ouvre Computer manuellement ?
   - Si plusieurs deploys successifs ?
   - Si deploy échoue ?

---

## 8. Conventions du projet

### Backend
- **Async/await partout** : FastAPI async, Dramatiq async actor
- **Logging structuré** : `logger.info()` avec context vars
- **Redis TTL** : keys expirent automatiquement (1h pour responses)
- **Retry logic** : `@retry` decorator sur ops critiques
- **Tool discovery** : `warm_up_tools_cache()` au démarrage

### Frontend
- **Server Components** par défaut (Next.js App Router)
- **"use client"** pour hooks, state, events
- **Zustand** pour state management global
- **Supabase client** : `createClient()` from `@/lib/supabase`
- **Types** : interfaces dans fichiers `*.tsx` (pas de séparation)

### Naming
- `snake_case` : Python, DB columns
- `camelCase` : TypeScript, JS
- `kebab-case` : URLs, file names frontend

---

**Document généré le** : 2026-03-15 14:30 UTC
**Par** : Claude (Sonnet 4.5)
**Pour** : Équipe Talos
