"""
Talos Cognitive Tools — Style Kimi
Implémente les patterns cognitifs manquants :
- todo_read / todo_write  → mshtools-todo_read/write de Kimi
- load_skill              → Skill injection dynamique de Kimi
- validate_step           → Per-step validation de Kimi

Ces tools sont la différence entre un agent qui se perd
et un agent qui reste sur ses rails sur des tâches longues.

Usage : ajouter dans core/tools/ et enregistrer dans tool_registry.py
"""

import json
import asyncio
from typing import Optional, List, Dict, Any
from datetime import datetime
from core.agentpress.tool import openapi_schema, ToolResult
from core.sandbox.tool_base import SandboxToolsBase


# ─────────────────────────────────────────────────────────────
# SKILL DEFINITIONS — équivalent des SKILL.md de Kimi
# Chaque skill est un guide spécialisé chargé dynamiquement
# ─────────────────────────────────────────────────────────────

TALOS_SKILLS = {
    "web_research": """
# Web Research Skill

## Workflow
1. Start with web_search for broad discovery (2-3 queries)
2. Identify the 2-3 most relevant URLs from results
3. Use browser_navigate_to on each URL
4. Use browser_extract_content to get the actual content
5. If content is behind login/paywall → try scrape_webpage as fallback
6. Synthesize findings across sources

## Quality rules
- Always verify information from at least 2 sources
- Include URLs in your final output for citations
- If a page fails to load → skip and try next URL
- For news/recent info → prioritize sources from last 30 days

## Output format
- Summary: 2-3 sentences
- Key findings: bullet points
- Sources: list of URLs used
""",

    "data_analysis": """
# Data Analysis Skill

## Workflow
1. Read the data file first with read_file
2. Run execute_python to inspect: df.head(), df.dtypes, df.describe()
3. Identify data quality issues (nulls, types, outliers)
4. Clean and transform as needed
5. Generate visualizations with matplotlib (save to /workspace/)
6. Write findings to a structured report

## Code patterns
```python
import pandas as pd
import matplotlib.pyplot as plt
import json

# Always start with inspection
df = pd.read_csv('/workspace/data.csv')
print(f"Shape: {df.shape}")
print(df.dtypes)
print(df.describe())
print(df.isnull().sum())
```

## Quality rules
- Never hardcode results — use real calculations
- Always check for nulls before aggregations
- Save all charts as PNG to /workspace/charts/
- Use execute_python in small chunks (not one giant block)
""",

    "code_generation": """
# Code Generation Skill

## Workflow
1. Understand requirements completely before writing any code
2. Create the file structure first with create_file
3. Write code in logical sections (not all at once)
4. Run execute_command or execute_python to test each section
5. Fix errors iteratively — never give up after first failure
6. Verify the final output actually works

## Quality rules
- Always run the code after writing it
- If it fails: read the error carefully, fix the specific issue
- Use execute_python for Python, execute_command for shell/node/etc
- Write modular code — functions, not one giant block
- Add error handling for file operations and network calls

## Error recovery
If execute fails → read the error → fix ONLY that specific error → retry
Never rewrite everything from scratch on first error.
""",

    "report_writing": """
# Report Writing Skill

## Workflow
1. Gather all data/research first (don't write until you have content)
2. Create outline: Executive Summary → Key Findings → Details → Conclusion
3. Write to /workspace/report.md first (easier to edit)
4. Convert to final format if needed (DOCX, PDF)

## Structure template
```markdown
# [Report Title]
**Date:** [date]
**Prepared by:** Talos AI

## Executive Summary
[2-3 sentence overview of key findings]

## Key Findings
- Finding 1: [specific, data-backed]
- Finding 2: [specific, data-backed]
- Finding 3: [specific, data-backed]

## Detailed Analysis
[Section per finding with supporting data]

## Conclusion & Recommendations
[Actionable next steps]

## Sources
[List of URLs/files used]
```

## Quality rules
- Every claim must be backed by data from your research
- Use specific numbers, not vague statements
- Executive summary must be standalone (no jargon)
- Always include a Sources section
""",

    "web_scraping": """
# Web Scraping Skill

## Workflow
1. Try browser_navigate_to + browser_extract_content first (most reliable)
2. If blocked → try scrape_webpage (Firecrawl)
3. If still blocked → try web_search with site: operator
4. Parse with execute_python (BeautifulSoup or regex)

## Code pattern
```python
import requests
from bs4 import BeautifulSoup

# Only if browser tools fail
response = requests.get(url, headers={
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
}, timeout=10)
soup = BeautifulSoup(response.text, 'html.parser')

# Remove noise
for tag in soup(['script', 'style', 'nav', 'footer', 'header']):
    tag.decompose()

text = soup.get_text(separator='\\n', strip=True)
```

## Anti-blocking rules
- Add delays between requests: time.sleep(1-2)
- Rotate User-Agent if needed
- Never hammer a site with rapid requests
""",

    "file_processing": """
# File Processing Skill

## Workflow
1. Check file exists: execute_command("ls -la /workspace/")
2. Read with read_file (for text) or execute_python (for binary/Excel/PDF)
3. Process in execute_python
4. Write results back with create_file or execute_python

## Format-specific patterns

### CSV/Excel
```python
import pandas as pd
df = pd.read_csv('/workspace/file.csv')  # or read_excel
# process...
df.to_csv('/workspace/output.csv', index=False)
```

### PDF
```python
import pdfplumber
with pdfplumber.open('/workspace/file.pdf') as pdf:
    text = '\\n'.join(page.extract_text() for page in pdf.pages)
```

### JSON
```python
import json
with open('/workspace/file.json') as f:
    data = json.load(f)
# process...
with open('/workspace/output.json', 'w') as f:
    json.dump(result, f, indent=2)
```
"""
}


# ─────────────────────────────────────────────────────────────
# COGNITIVE TOOLS CLASS
# ─────────────────────────────────────────────────────────────

class TalosCognitiveTools(SandboxToolsBase):
    """
    Cognitive tools pour Talos — inspirés des patterns Kimi.
    Ces tools donnent à l'agent une mémoire de travail et
    des guides spécialisés chargés à la demande.
    """

    TODO_PATH = "/workspace/.talos_todo.json"
    SKILLS_PATH = "/workspace/.talos_skills/"

    def __init__(self, project_id: str, thread_manager=None):
        super().__init__(project_id, thread_manager)

    # ─────────────────────────────────────────────
    # TODO MANAGEMENT — équivalent Kimi todo_read/write
    # ─────────────────────────────────────────────

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "todo_read",
            "description": (
                "Read the current task plan for this session. "
                "Call this at the START of every task to check what's planned and what's done. "
                "Call it frequently to stay on track during multi-step tasks."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
    async def todo_read(self) -> ToolResult:
        try:
            sandbox = await self._ensure_sandbox()
            content = await sandbox.filesystem.read(self.TODO_PATH)
            data = json.loads(content)
            
            # Formater pour le LLM
            todos = data.get("todos", [])
            if not todos:
                return self.success_response({
                    "status": "empty",
                    "message": "No tasks planned yet. Use todo_write to create a plan.",
                    "todos": []
                })
            
            # Grouper par status
            in_progress = [t for t in todos if t["status"] == "in_progress"]
            pending = [t for t in todos if t["status"] == "pending"]
            completed = [t for t in todos if t["status"] == "completed"]
            
            summary = f"Tasks: {len(completed)} done, {len(in_progress)} in progress, {len(pending)} pending"
            
            return self.success_response({
                "summary": summary,
                "in_progress": in_progress,
                "pending": pending,
                "completed": completed,
                "total": len(todos),
                "last_updated": data.get("last_updated", "unknown")
            })
            
        except Exception:
            return self.success_response({
                "status": "empty",
                "message": "No task plan found. Create one with todo_write before starting.",
                "todos": []
            })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "todo_write",
            "description": (
                "Create or update the task plan for this session. "
                "ALWAYS create a plan before starting a complex task (3+ steps). "
                "Update it after each completed step. "
                "Only ONE task should be 'in_progress' at a time."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "todos": {
                        "type": "array",
                        "description": "Complete list of tasks (replaces existing list)",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "Unique ID like '1', '2', '3'"
                                },
                                "content": {
                                    "type": "string",
                                    "description": "Clear, specific task description"
                                },
                                "status": {
                                    "type": "string",
                                    "enum": ["pending", "in_progress", "completed"],
                                    "description": "Current status"
                                },
                                "priority": {
                                    "type": "string",
                                    "enum": ["high", "medium", "low"],
                                    "description": "Task priority"
                                }
                            },
                            "required": ["id", "content", "status", "priority"]
                        }
                    }
                },
                "required": ["todos"]
            }
        }
    })
    async def todo_write(self, todos: List[Dict]) -> ToolResult:
        try:
            # Validation
            in_progress_count = sum(1 for t in todos if t.get("status") == "in_progress")
            if in_progress_count > 1:
                return self.fail_response(
                    f"Only 1 task can be 'in_progress' at a time. Found {in_progress_count}."
                )
            
            data = {
                "todos": todos,
                "last_updated": datetime.now().isoformat(),
                "total": len(todos)
            }
            
            sandbox = await self._ensure_sandbox()
            await sandbox.filesystem.write(
                self.TODO_PATH,
                json.dumps(data, indent=2, ensure_ascii=False)
            )
            
            # Summary pour le LLM
            completed = sum(1 for t in todos if t["status"] == "completed")
            in_progress = sum(1 for t in todos if t["status"] == "in_progress")
            pending = sum(1 for t in todos if t["status"] == "pending")
            
            current = next((t["content"] for t in todos if t["status"] == "in_progress"), None)
            
            return self.success_response({
                "saved": True,
                "summary": f"{completed} done / {in_progress} active / {pending} pending",
                "current_task": current or "None active",
                "total_tasks": len(todos)
            })
            
        except Exception as e:
            return self.fail_response(f"Failed to save todo: {str(e)}")

    # ─────────────────────────────────────────────
    # SKILL INJECTION — équivalent Kimi SKILL.md
    # ─────────────────────────────────────────────

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "load_skill",
            "description": (
                "Load specialized instructions for a specific type of task. "
                "Call this BEFORE starting any specialized task to get expert guidance. "
                "Available skills: web_research, data_analysis, code_generation, "
                "report_writing, web_scraping, file_processing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "skill_name": {
                        "type": "string",
                        "enum": [
                            "web_research",
                            "data_analysis",
                            "code_generation",
                            "report_writing",
                            "web_scraping",
                            "file_processing"
                        ],
                        "description": "The skill to load"
                    }
                },
                "required": ["skill_name"]
            }
        }
    })
    async def load_skill(self, skill_name: str) -> ToolResult:
        if skill_name not in TALOS_SKILLS:
            available = list(TALOS_SKILLS.keys())
            return self.fail_response(
                f"Unknown skill '{skill_name}'. Available: {available}"
            )
        
        skill_content = TALOS_SKILLS[skill_name]
        
        # Aussi sauvegarder dans le sandbox pour référence
        try:
            sandbox = await self._ensure_sandbox()
            await sandbox.commands.run(f"mkdir -p {self.SKILLS_PATH}")
            await sandbox.filesystem.write(
                f"{self.SKILLS_PATH}{skill_name}.md",
                skill_content
            )
        except Exception:
            pass  # Non-critique si ça échoue
        
        return self.success_response({
            "skill": skill_name,
            "loaded": True,
            "instructions": skill_content
        })

    # ─────────────────────────────────────────────
    # STEP VALIDATION — équivalent Kimi per-step validation
    # ─────────────────────────────────────────────

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "validate_step",
            "description": (
                "Validate that a completed step actually succeeded before moving on. "
                "Use after any critical operation (file creation, code execution, web navigation). "
                "Checks if the expected result exists in the workspace."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "check_type": {
                        "type": "string",
                        "enum": ["file_exists", "command_output", "python_eval"],
                        "description": "Type of validation to perform"
                    },
                    "target": {
                        "type": "string",
                        "description": (
                            "For file_exists: path to check. "
                            "For command_output: shell command to run and check. "
                            "For python_eval: Python expression that should return True."
                        )
                    },
                    "expected": {
                        "type": "string",
                        "description": "Optional: expected value or substring in output"
                    }
                },
                "required": ["check_type", "target"]
            }
        }
    })
    async def validate_step(
        self,
        check_type: str,
        target: str,
        expected: Optional[str] = None
    ) -> ToolResult:
        sandbox = await self._ensure_sandbox()
        
        try:
            if check_type == "file_exists":
                result = await sandbox.commands.run(
                    f"test -f '{target}' && echo 'EXISTS' && ls -lh '{target}' || echo 'NOT_FOUND'",
                    timeout=10
                )
                exists = "EXISTS" in result.stdout
                return self.success_response({
                    "valid": exists,
                    "check": f"File: {target}",
                    "result": result.stdout.strip(),
                    "message": "✅ File exists" if exists else "❌ File not found"
                })
            
            elif check_type == "command_output":
                result = await sandbox.commands.run(target, timeout=30)
                output = result.stdout + result.stderr
                
                if expected:
                    valid = expected.lower() in output.lower()
                else:
                    valid = result.exit_code == 0
                
                return self.success_response({
                    "valid": valid,
                    "exit_code": result.exit_code,
                    "output": output[:500],
                    "expected": expected,
                    "message": "✅ Validation passed" if valid else "❌ Validation failed"
                })
            
            elif check_type == "python_eval":
                exec_result = await sandbox.run_code(
                    f"result = bool({target})\nprint('VALID' if result else 'INVALID')"
                )
                output = exec_result.text or ""
                valid = "VALID" in output
                
                return self.success_response({
                    "valid": valid,
                    "expression": target,
                    "output": output,
                    "message": "✅ Expression is True" if valid else "❌ Expression is False"
                })
            
            else:
                return self.fail_response(f"Unknown check_type: {check_type}")
                
        except Exception as e:
            return self.fail_response(f"Validation error: {str(e)}")

    # ─────────────────────────────────────────────
    # SESSION MEMORY — persistance légère entre steps
    # ─────────────────────────────────────────────

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "remember",
            "description": (
                "Store a key piece of information for later use in this session. "
                "Use to save URLs, API results, file paths, or important data "
                "that you'll need to reference later."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "Short descriptive key (e.g., 'target_url', 'api_result', 'file_path')"
                    },
                    "value": {
                        "type": "string",
                        "description": "The value to remember"
                    }
                },
                "required": ["key", "value"]
            }
        }
    })
    async def remember(self, key: str, value: str) -> ToolResult:
        memory_path = "/workspace/.talos_memory.json"
        
        try:
            sandbox = await self._ensure_sandbox()
            
            # Lire la mémoire existante
            try:
                existing = await sandbox.filesystem.read(memory_path)
                memory = json.loads(existing)
            except Exception:
                memory = {}
            
            # Ajouter/mettre à jour
            memory[key] = {
                "value": value,
                "timestamp": datetime.now().isoformat()
            }
            
            await sandbox.filesystem.write(
                memory_path,
                json.dumps(memory, indent=2, ensure_ascii=False)
            )
            
            return self.success_response({
                "stored": True,
                "key": key,
                "value": value,
                "total_memories": len(memory)
            })
            
        except Exception as e:
            return self.fail_response(f"Failed to store memory: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "recall",
            "description": (
                "Retrieve previously stored information from session memory. "
                "Call without a key to see all stored items."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "Key to retrieve (optional — omit to see all)"
                    }
                },
                "required": []
            }
        }
    })
    async def recall(self, key: Optional[str] = None) -> ToolResult:
        memory_path = "/workspace/.talos_memory.json"
        
        try:
            sandbox = await self._ensure_sandbox()
            
            try:
                existing = await sandbox.filesystem.read(memory_path)
                memory = json.loads(existing)
            except Exception:
                return self.success_response({
                    "memory": {},
                    "message": "No stored memories yet"
                })
            
            if key:
                if key in memory:
                    return self.success_response({
                        "key": key,
                        "value": memory[key]["value"],
                        "stored_at": memory[key]["timestamp"]
                    })
                else:
                    available = list(memory.keys())
                    return self.success_response({
                        "found": False,
                        "key": key,
                        "available_keys": available
                    })
            else:
                # Retourner tout
                simplified = {k: v["value"] for k, v in memory.items()}
                return self.success_response({
                    "all_memories": simplified,
                    "count": len(memory)
                })
                
        except Exception as e:
            return self.fail_response(f"Failed to recall: {str(e)}")
