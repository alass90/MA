# Computer Panel - Analyse complète du flux

**Date**: 2026-03-15
**Objectif**: Comprendre le flux exact du panel Computer pour implémenter l'interception style Manus

---

## 1. Architecture actuelle - Panel Computer

### Frontend

#### Composant principal
**Fichier**: `frontend/src/components/thread/tool-call-side-panel.tsx`

```tsx
// Props principales
interface ToolCallSidePanelProps {
  isOpen: boolean;              // État ouverture panel
  onClose: () => void;
  toolCalls: ToolCallInput[];   // Liste des tool calls
  currentIndex: number;         // Index tool affiché
  onNavigate: (newIndex: number) => void;
  messages?: ApiMessageType[];
  agentStatus: string;
  // ...
}

// Rendu desktop - ResizablePanel
<ResizablePanelGroup>
  <ResizablePanel ref={mainPanelRef} defaultSize={60}>
    {/* Contenu principal (chat) */}
  </ResizablePanel>

  {shouldShowPanel && (
    <ResizablePanel ref={sidePanelRef} defaultSize={40}>
      <ToolCallSidePanel
        isOpen={true}
        toolCalls={toolCalls}
        messages={messages}
        // ...
      />
    </ResizablePanel>
  )}
</ResizablePanelGroup>
```

**Icons**: `<Computer />` (lucide-react)
**Deux vues**:
- `tools` : affiche les tool calls (fichiers, shell, etc.)
- `browser` : affiche le navigateur VNC

#### State Management
**Fichier**: `frontend/src/hooks/messages/useThreadToolCalls.ts`

```ts
export function useThreadToolCalls(messages, ...): UseThreadToolCallsReturn {
  // États principaux
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCallInput[]>([]);
  const [currentToolIndex, setCurrentToolIndex] = useState(0);
  const [autoOpenedPanel, setAutoOpenedPanel] = useState(false);
  const userClosedPanelRef = useRef(false);

  // OUVERTURE AUTOMATIQUE (lignes 167-171)
  if (!isSidePanelOpen && !autoOpenedPanel &&
      !userClosedPanelRef.current && !isMobile && !compact) {
    setCurrentToolIndex(historicalToolPairs.length - 1);
    setIsSidePanelOpen(true);  // ← AUTO-OPEN ICI
    setAutoOpenedPanel(true);
  }

  return {
    isSidePanelOpen,
    setIsSidePanelOpen,  // ← Exposé pour fermeture manuelle
    toggleSidePanel,
    // ...
  };
}
```

**Déclencheur** : Dès qu'un `toolCall` est détecté dans les messages, le panel s'ouvre automatiquement.

#### Intégration dans ThreadComponent
**Fichier**: `frontend/src/components/thread/ThreadComponent.tsx`

```tsx
// Ligne 156-167: Import du hook
const {
  toolCalls,
  isSidePanelOpen,
  setIsSidePanelOpen,  // ← On peut fermer le panel avec ça
  toggleSidePanel,
  handleToolClick,
  // ...
} = useThreadToolCalls(messages, setLeftSidebarOpen, agentStatus, compact);

// Ligne 963-1000: Passage au Layout
<ThreadLayout
  isSidePanelOpen={isSidePanelOpen}
  onToggleSidePanel={toggleSidePanel}
  toolCalls={toolCalls}
  messages={messages}
  // ...
/>
```

---

## 2. Backend - Émission des events

### Flux complet

```
1. Tool exécuté (ex: sb_files_tool.create_file)
   ↓
2. ToolResult retourné au ResponseProcessor
   ↓
3. response_processor.py:_save_tool_result_message()
   ↓
4. thread_manager.add_message(type='tool', metadata={...})
   ↓
5. Supabase INSERT into messages table
   ↓
6. Supabase Realtime → Frontend
   ↓
7. useThreadToolCalls détecte nouveau message
   ↓
8. Auto-open panel Computer
```

### Structure des messages

**Fichier**: `backend/core/agentpress/response_processor.py`

#### Ligne 2000-2006: Message tool sauvegardé
```python
message_obj = await self.add_message(
    thread_id=thread_id,
    type="tool",  # ← Type message
    content=tool_message,  # Contenu pour LLM
    is_llm_message=True,
    metadata={
        "function_name": function_name,        # Ex: "create_file"
        "result": {                            # Résultat structuré
            "output": "File created...",
            "success": true,
            "error": null
        },
        "return_format": "native",             # ou "xml"
        "tool_call_id": "call_xyz",
        "assistant_message_id": "msg_abc"
    }
)
```

**Ligne 2172-2175**: Status messages
```python
# Optionnel: message status pour UI
await self.add_message(
    thread_id=thread_id,
    type="status",
    content={
        "status_type": "tool_completed",  # ou "tool_failed", "tool_error"
        "function_name": context.function_name,
        "tool_index": context.tool_index
    },
    metadata={
        "linked_tool_result_message_id": tool_message_id,
        "agent_should_terminate": True  # Si tool = ask/complete
    }
)
```

### Table Supabase `messages`

```sql
CREATE TABLE messages (
  message_id UUID PRIMARY KEY,
  thread_id UUID NOT NULL,
  type TEXT NOT NULL,  -- 'assistant', 'tool', 'status', 'user'
  content JSONB,
  metadata JSONB,      -- Contient function_name, result, etc.
  is_llm_message BOOLEAN,
  created_at TIMESTAMPTZ
);
```

---

## 3. Points d'interception identifiés

### ✅ Option 1: Frontend - Hook personnalisé (RECOMMANDÉ)

**Où**: `frontend/src/hooks/use-web-file-detector.ts` (nouveau fichier)

**Principe**:
- Écoute les messages en parallèle de `useThreadToolCalls`
- Détecte les fichiers web créés (`.html`, `.jsx`, `.tsx`, etc.)
- Si détecté → ferme Computer, ouvre Preview

**Code**:
```ts
export function useWebFileDetector(
  messages: UnifiedMessage[],
  setComputerPanelOpen: (open: boolean) => void,
  openPreviewPanel: (url: string) => void
) {
  useEffect(() => {
    // Parcourir messages récents
    for (const msg of messages.slice().reverse()) {
      if (msg.type !== 'tool') continue;

      const metadata = JSON.parse(msg.metadata || '{}');
      const functionName = metadata.function_name;

      // Detect file creation
      if (functionName === 'create_file') {
        const result = metadata.result;
        const args = extractArguments(msg); // helper
        const filePath = args?.file_path || '';

        // Check if web file
        if (isWebFile(filePath)) { // .html, .jsx, .tsx
          // ✅ INTERCEPTION ICI
          setComputerPanelOpen(false);  // Ferme Computer

          // Get preview URL from sandbox
          const previewUrl = buildPreviewUrl(sandboxId, filePath);
          openPreviewPanel(previewUrl);

          break; // Stop après première détection
        }
      }
    }
  }, [messages]);
}

function isWebFile(path: string): boolean {
  return /\.(html|jsx|tsx|vue|svelte)$/i.test(path);
}
```

**Intégration dans ThreadComponent**:
```tsx
// Ajouter après useThreadToolCalls
const {
  isSidePanelOpen,
  setIsSidePanelOpen,
  // ...
} = useThreadToolCalls(...);

// Nouveau hook
useWebFileDetector(
  messages,
  setIsSidePanelOpen,  // ← Contrôle Computer panel
  (url) => {
    // Ouvrir preview panel (déjà existant via use-preview-panel-store)
    const { openPanel } = usePreviewPanelStore.getState();
    openPanel({ previewUrl: url, ... });
  }
);
```

---

### ✅ Option 2: Backend - Metadata enrichi

**Où**: `backend/core/tools/sb_files_tool.py` (ligne 141-144, déjà modifié)

**Principe**:
- Quand `_trigger_auto_deploy()` est appelé, ajouter flag dans metadata
- Frontend détecte ce flag → ouvre Preview au lieu de Computer

**Modification backend**:
```python
# sb_files_tool.py:create_file()
if should_auto_deploy:
    result = await self._trigger_auto_deploy(file_path)

    # Retourner metadata spécial
    return self.success_response(
        message=f"File '{file_path}' created successfully.",
        metadata={
            "auto_preview_triggered": True,  # ← FLAG
            "preview_url": result.url if result else None,
            "deployment_id": result.deployment_id if result else None
        }
    )
```

**Détection frontend**:
```ts
// use-web-file-detector.ts
if (metadata.auto_preview_triggered) {
  setComputerPanelOpen(false);
  openPreviewPanel({
    previewUrl: metadata.preview_url,
    deploymentId: metadata.deployment_id
  });
}
```

**⚠️ Limitation**: ToolResult ne supporte pas `metadata` custom actuellement. Il faudrait modifier `ToolResult` class.

---

### ✅ Option 3: Hybrid - Filter dans useThreadToolCalls

**Où**: `frontend/src/hooks/messages/useThreadToolCalls.ts` (ligne 114-117)

**Principe**:
- Modifier la fonction `shouldFilterTool()` pour filtrer les fichiers web
- Empêcher leur ajout dans `toolCalls` → Computer ne les affiche pas
- Hook séparé gère l'ouverture Preview

**Code**:
```ts
// useThreadToolCalls.ts
function shouldFilterTool(toolName: string, metadata?: any): boolean {
  // Filter ask/complete
  if (isAskOrCompleteTool(toolName)) return true;

  // ✅ NOUVEAU: Filter web file creation
  if (toolName === 'create-file' && metadata) {
    const result = metadata.result || {};
    const filePath = result.file_path || '';

    if (isWebFile(filePath)) {
      return true;  // ← Ne pas afficher dans Computer
    }
  }

  return false;
}

// Ligne 93-156: Appliquer le filtre
resultMessages.forEach(resultMessage => {
  const toolMetadata = safeJsonParse(resultMessage.metadata, {});
  const functionName = toolMetadata.function_name;

  // ✅ FILTRE ICI
  if (shouldFilterTool(functionName, toolMetadata)) {
    return; // Skip
  }

  // Continue normal processing...
});
```

**Avantage**: Computer panel ne montre **jamais** les fichiers web, même manuellement.

---

## 4. Recommandation finale

### Architecture proposée

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend - ThreadComponent.tsx                             │
│                                                             │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │ useThreadToolCalls│      │ useWebFileDetector│          │
│  │                  │      │ (NOUVEAU)         │          │
│  │ - toolCalls      │      │                  │          │
│  │ - isSidePanelOpen│◀────▶│ Détecte web files│          │
│  │ - setIsSidePanel │      │ Contrôle panels  │          │
│  └──────────────────┘      └──────────────────┘           │
│         │                           │                      │
│         ▼                           ▼                      │
│  ┌──────────────────┐      ┌──────────────────┐           │
│  │ Computer Panel   │      │ Preview Panel    │           │
│  │ (générique)      │      │ (web files only) │           │
│  └──────────────────┘      └──────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Implémentation step-by-step

**Étape 1**: Créer `useWebFileDetector` hook
```ts
// frontend/src/hooks/use-web-file-detector.ts
import { useEffect } from 'react';
import { UnifiedMessage } from '@/components/thread/types';
import { usePreviewPanelStore } from '@/stores/use-preview-panel-store';

export function useWebFileDetector(
  messages: UnifiedMessage[],
  sandboxId: string | null,
  setComputerPanelOpen: (open: boolean) => void
) {
  const { openPanel: openPreviewPanel } = usePreviewPanelStore();

  useEffect(() => {
    if (!sandboxId) return;

    // Get last tool message
    const lastToolMsg = messages
      .filter(m => m.type === 'tool')
      .slice(-1)[0];

    if (!lastToolMsg) return;

    try {
      const metadata = JSON.parse(lastToolMsg.metadata || '{}');
      const functionName = metadata.function_name;

      // Check file creation
      if (functionName === 'create_file') {
        const result = metadata.result || {};
        const args = JSON.parse(lastToolMsg.content?.arguments || '{}');
        const filePath = args.file_path || '';

        // Detect web file
        if (/\.(html|jsx|tsx|vue|svelte)$/i.test(filePath)) {
          // Close Computer
          setComputerPanelOpen(false);

          // Open Preview
          const previewUrl = `https://8080-${sandboxId}.daytonaproxy01.net/${filePath}`;
          openPreviewPanel({
            previewUrl,
            projectPath: filePath,
            framework: detectFramework(filePath)
          });
        }
      }
    } catch (e) {
      console.error('Web file detection error:', e);
    }
  }, [messages, sandboxId]);
}
```

**Étape 2**: Intégrer dans ThreadComponent
```tsx
// ThreadComponent.tsx - après ligne 167
const {
  isSidePanelOpen,
  setIsSidePanelOpen,
  toolCalls,
  // ...
} = useThreadToolCalls(messages, setLeftSidebarOpen, agentStatus, compact);

// ✅ NOUVEAU
useWebFileDetector(messages, sandboxId, setIsSidePanelOpen);
```

**Étape 3**: (Optionnel) Filtrer les web files de Computer
```ts
// useThreadToolCalls.ts - ligne 114
function shouldFilterTool(toolName: string, metadata?: any): boolean {
  if (isAskOrCompleteTool(toolName)) return true;

  // ✅ Filter web files
  if (toolName === 'create_file' && metadata?.result) {
    const args = metadata.result.arguments || {};
    const filePath = args.file_path || '';
    if (/\.(html|jsx|tsx)$/i.test(filePath)) {
      return true;
    }
  }

  return false;
}
```

---

## 5. Testing checklist

- [ ] Créer thread, dire "create a simple landing page"
- [ ] Vérifier: Computer panel se ferme automatiquement
- [ ] Vérifier: Preview panel s'ouvre avec iframe
- [ ] Vérifier: URL Daytona correcte (port 8080)
- [ ] Créer fichier non-web (`.py`, `.txt`) → Computer reste ouvert
- [ ] Créer plusieurs fichiers web → Preview switch vers le dernier
- [ ] Fermer Preview manuellement → ne se réouvre pas automatiquement
- [ ] Mobile: vérifier comportement (pas de preview panel)

---

**Document créé le**: 2026-03-15 14:50 UTC
**Par**: Claude (Sonnet 4.5)
