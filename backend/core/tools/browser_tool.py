"""
Talos Browser Tool — Playwright direct dans E2B sandbox
Remplace Stagehand (port 8004) par Playwright natif.

Implémente les équivalents des mshtools-browser_* de Kimi :
- browser_navigate_to    → mshtools-browser_visit
- browser_screenshot     → mshtools-browser_screenshot  
- browser_extract_content → mshtools-browser_find + extract
- browser_click          → mshtools-browser_click
- browser_input          → mshtools-browser_input
- browser_scroll         → mshtools-browser_scroll_down/up
- browser_get_state      → mshtools-browser_state

Usage : remplace core/tools/browser_tool.py dans Talos
"""

import json
import base64
import asyncio
from typing import Optional, Dict, Any, List
from core.agentpress.tool import openapi_schema, ToolResult
from core.sandbox.tool_base import SandboxToolsBase


# Script Python injecté dans le sandbox E2B pour Playwright
# Ce script tourne DANS le sandbox, pas dans le backend
PLAYWRIGHT_RUNNER = '''
import sys
import json
import base64
from playwright.sync_api import sync_playwright

def run(action: str, params: dict) -> dict:
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        )
        context = browser.new_context(
            viewport={"width": 1280, "height": 720},
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()
        result = {}

        try:
            if action == "navigate":
                url = params["url"]
                page.goto(url, timeout=30000, wait_until="domcontentloaded")
                page.wait_for_timeout(1500)
                
                # Extraire les éléments interactifs
                elements = page.evaluate("""() => {
                    const interactive = [];
                    const selectors = 'a, button, input, textarea, select, [role="button"], [role="link"]';
                    document.querySelectorAll(selectors).forEach((el, idx) => {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            interactive.push({
                                index: idx,
                                tag: el.tagName.toLowerCase(),
                                type: el.type || "",
                                text: (el.innerText || el.value || el.placeholder || "").trim()[:100],
                                href: el.href || "",
                                id: el.id || "",
                                name: el.name || ""
                            });
                        }
                    });
                    return interactive[:50];
                }""")
                
                result = {
                    "success": True,
                    "url": page.url,
                    "title": page.title(),
                    "elements": elements,
                    "element_count": len(elements)
                }

            elif action == "screenshot":
                url = params.get("url")
                if url:
                    page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    page.wait_for_timeout(1000)
                screenshot_bytes = page.screenshot(type="png", full_page=False)
                result = {
                    "success": True,
                    "screenshot_base64": base64.b64encode(screenshot_bytes).decode(),
                    "url": page.url,
                    "title": page.title()
                }

            elif action == "extract":
                url = params.get("url")
                instruction = params.get("instruction", "extract all content")
                if url:
                    page.goto(url, timeout=30000, wait_until="domcontentloaded")
                    page.wait_for_timeout(1000)
                
                # Extraction du contenu textuel principal
                content = page.evaluate("""() => {
                    // Supprimer nav, footer, ads
                    const remove = document.querySelectorAll(
                        'nav, footer, header, script, style, .ad, .advertisement, #cookie-notice'
                    );
                    remove.forEach(el => el.remove());
                    
                    // Extraire le texte principal
                    const main = document.querySelector('main, article, .content, #content, body');
                    return (main || document.body).innerText.trim()[:5000];
                }""")
                
                # Extraire aussi les liens
                links = page.evaluate("""() => {
                    return Array.from(document.querySelectorAll('a[href]'))
                        .filter(a => a.href && !a.href.startsWith('javascript'))
                        .slice(0, 20)
                        .map(a => ({text: a.innerText.trim()[:80], href: a.href}));
                }""")
                
                result = {
                    "success": True,
                    "url": page.url,
                    "title": page.title(),
                    "content": content,
                    "links": links,
                    "instruction": instruction
                }

            elif action == "click":
                element_index = params.get("element_index", 0)
                selectors = 'a, button, input, textarea, select, [role="button"], [role="link"]'
                elements = page.query_selector_all(selectors)
                
                if element_index < len(elements):
                    elements[element_index].scroll_into_view_if_needed()
                    elements[element_index].click(timeout=5000)
                    page.wait_for_timeout(1000)
                    result = {
                        "success": True,
                        "url": page.url,
                        "title": page.title(),
                        "action": f"Clicked element {element_index}"
                    }
                else:
                    result = {
                        "success": False,
                        "error": f"Element index {element_index} not found (total: {len(elements)})"
                    }

            elif action == "input":
                element_index = params.get("element_index", 0)
                text = params.get("text", "")
                selectors = 'input[type="text"], input[type="search"], input[type="email"], textarea, input:not([type])'
                elements = page.query_selector_all(selectors)
                
                if element_index < len(elements):
                    elements[element_index].click()
                    elements[element_index].fill(text)
                    page.wait_for_timeout(500)
                    result = {
                        "success": True,
                        "action": f"Typed '{text}' into element {element_index}"
                    }
                else:
                    result = {
                        "success": False,
                        "error": f"Input element {element_index} not found"
                    }

            elif action == "scroll":
                direction = params.get("direction", "down")
                amount = params.get("amount", 500)
                if direction == "down":
                    page.evaluate(f"window.scrollBy(0, {amount})")
                else:
                    page.evaluate(f"window.scrollBy(0, -{amount})")
                page.wait_for_timeout(500)
                result = {
                    "success": True,
                    "action": f"Scrolled {direction} by {amount}px"
                }

            elif action == "find":
                keyword = params.get("keyword", "")
                found = page.evaluate(f"""() => {{
                    const walker = document.createTreeWalker(
                        document.body, NodeFilter.SHOW_TEXT
                    );
                    let node;
                    while (node = walker.nextNode()) {{
                        if (node.textContent.toLowerCase().includes('{keyword.lower()}')) {{
                            const el = node.parentElement;
                            el.scrollIntoView();
                            return {{
                                found: true,
                                text: node.textContent.trim()[:200],
                                tag: el.tagName
                            }};
                        }}
                    }}
                    return {{found: false}};
                }}""")
                result = {
                    "success": True,
                    "keyword": keyword,
                    **found
                }

        except Exception as e:
            result = {"success": False, "error": str(e)}
        finally:
            browser.close()
        
        return result

# Lire les params depuis stdin
data = json.loads(sys.stdin.read())
output = run(data["action"], data["params"])
print(json.dumps(output))
'''


class TalosBrowserTool(SandboxToolsBase):
    """
    Browser tool pour Talos utilisant Playwright directement dans E2B.
    Pas de dépendance à Stagehand ou à un serveur externe.
    """

    def __init__(self, project_id: str, thread_manager=None):
        super().__init__(project_id, thread_manager)
        self._playwright_installed = False
        self._session_url: Optional[str] = None
        self._citation_counter = 0
        self._citations: Dict[int, str] = {}

    # ─────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────

    async def _ensure_playwright(self) -> bool:
        """Vérifie que Playwright est installé dans le sandbox."""
        if self._playwright_installed:
            return True
        
        sandbox = await self._ensure_sandbox()
        
        # Check si playwright est déjà installé
        check = await sandbox.commands.run(
            "python3 -c 'from playwright.sync_api import sync_playwright; print(\"ok\")'",
            timeout=10
        )
        
        if check.exit_code == 0 and "ok" in check.stdout:
            self._playwright_installed = True
            return True
        
        # Installer playwright + chromium
        install = await sandbox.commands.run(
            "pip install playwright --quiet && python3 -m playwright install chromium --with-deps 2>&1 | tail -5",
            timeout=120
        )
        
        if install.exit_code == 0:
            self._playwright_installed = True
            return True
        
        return False

    async def _run_playwright(self, action: str, params: dict) -> dict:
        """Exécute une action Playwright dans le sandbox E2B."""
        sandbox = await self._ensure_sandbox()
        
        # S'assurer que Playwright est dispo
        pw_ok = await self._ensure_playwright()
        if not pw_ok:
            return {"success": False, "error": "Failed to install Playwright in sandbox"}
        
        # Écrire le script runner dans le sandbox
        await sandbox.filesystem.write(
            "/workspace/.playwright_runner.py",
            PLAYWRIGHT_RUNNER
        )
        
        # Préparer les params JSON
        input_json = json.dumps({"action": action, "params": params})
        escaped = input_json.replace("'", "'\\''")
        
        # Exécuter le script
        result = await sandbox.commands.run(
            f"echo '{escaped}' | python3 /workspace/.playwright_runner.py",
            timeout=60
        )
        
        if result.exit_code != 0:
            return {
                "success": False,
                "error": result.stderr or "Playwright script failed",
                "stdout": result.stdout
            }
        
        try:
            return json.loads(result.stdout.strip())
        except json.JSONDecodeError:
            return {
                "success": False,
                "error": "Failed to parse Playwright output",
                "raw": result.stdout[:500]
            }

    def _register_citation(self, url: str) -> int:
        """Enregistre une URL et retourne son citation_id."""
        self._citation_counter += 1
        self._citations[self._citation_counter] = url
        self._session_url = url
        return self._citation_counter

    # ─────────────────────────────────────────────
    # PUBLIC TOOLS
    # ─────────────────────────────────────────────

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_navigate_to",
            "description": (
                "Navigate to a URL in the browser. Returns the page title, URL, "
                "and a list of interactive elements (links, buttons, inputs) with their indices. "
                "Use the element indices with browser_click or browser_input."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL to navigate to (must include https://)"
                    }
                },
                "required": ["url"]
            }
        }
    })
    async def browser_navigate_to(self, url: str) -> ToolResult:
        result = await self._run_playwright("navigate", {"url": url})
        
        if not result.get("success"):
            return self.fail_response(
                f"Failed to navigate to {url}: {result.get('error', 'Unknown error')}"
            )
        
        citation_id = self._register_citation(result["url"])
        
        # Formater les éléments pour le LLM
        elements_text = ""
        for el in result.get("elements", [])[:20]:
            text = el.get("text", "")[:60]
            tag = el.get("tag", "")
            href = el.get("href", "")[:80]
            idx = el.get("index", 0)
            if text or href:
                elements_text += f"  [{idx}] <{tag}> {text}"
                if href:
                    elements_text += f" → {href}"
                elements_text += "\n"
        
        return self.success_response({
            "citation_id": citation_id,
            "url": result["url"],
            "title": result["title"],
            "interactive_elements": elements_text or "No interactive elements found",
            "element_count": result.get("element_count", 0)
        })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_screenshot",
            "description": (
                "Take a screenshot of the current page or navigate to a URL and screenshot it. "
                "Returns a base64 PNG image for visual inspection."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Optional URL to navigate to before screenshotting"
                    },
                    "save_path": {
                        "type": "string",
                        "description": "Optional path to save the screenshot in /workspace"
                    }
                },
                "required": []
            }
        }
    })
    async def browser_screenshot(
        self,
        url: Optional[str] = None,
        save_path: Optional[str] = None
    ) -> ToolResult:
        params = {}
        if url:
            params["url"] = url
        elif self._session_url:
            params["url"] = self._session_url
        else:
            return self.fail_response("No URL provided and no current page. Call browser_navigate_to first.")
        
        result = await self._run_playwright("screenshot", params)
        
        if not result.get("success"):
            return self.fail_response(
                f"Screenshot failed: {result.get('error', 'Unknown error')}"
            )
        
        # Sauvegarder si demandé
        if save_path and result.get("screenshot_base64"):
            sandbox = await self._ensure_sandbox()
            img_bytes = base64.b64decode(result["screenshot_base64"])
            await sandbox.filesystem.write_bytes(save_path, img_bytes)
        
        return self.success_response({
            "url": result.get("url", ""),
            "title": result.get("title", ""),
            "screenshot_base64": result.get("screenshot_base64", ""),
            "saved_to": save_path or "not saved"
        })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_extract_content",
            "description": (
                "Extract text content and links from the current page or a specific URL. "
                "Use this after browser_navigate_to to get the actual content of a page. "
                "Much more reliable than web scraping for dynamic pages."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "instruction": {
                        "type": "string",
                        "description": "What to extract (e.g., 'extract main article content', 'find all product prices')"
                    },
                    "url": {
                        "type": "string",
                        "description": "Optional URL to navigate to before extracting"
                    }
                },
                "required": ["instruction"]
            }
        }
    })
    async def browser_extract_content(
        self,
        instruction: str,
        url: Optional[str] = None
    ) -> ToolResult:
        params = {"instruction": instruction}
        if url:
            params["url"] = url
        elif self._session_url:
            params["url"] = self._session_url
        else:
            return self.fail_response("No URL to extract from. Call browser_navigate_to first.")
        
        result = await self._run_playwright("extract", params)
        
        if not result.get("success"):
            return self.fail_response(
                f"Content extraction failed: {result.get('error', 'Unknown error')}"
            )
        
        return self.success_response({
            "url": result.get("url", ""),
            "title": result.get("title", ""),
            "content": result.get("content", ""),
            "links": result.get("links", []),
            "instruction": instruction
        })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_click",
            "description": (
                "Click an interactive element on the page by its index. "
                "Get element indices from browser_navigate_to first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "element_index": {
                        "type": "integer",
                        "description": "Zero-based index of the element to click"
                    },
                    "url": {
                        "type": "string",
                        "description": "Optional URL to navigate to before clicking"
                    }
                },
                "required": ["element_index"]
            }
        }
    })
    async def browser_click(
        self,
        element_index: int,
        url: Optional[str] = None
    ) -> ToolResult:
        params = {"element_index": element_index}
        if url:
            params["url"] = url
        elif self._session_url:
            params["url"] = self._session_url
        else:
            return self.fail_response("No current page. Call browser_navigate_to first.")
        
        result = await self._run_playwright("click", params)
        
        if not result.get("success"):
            return self.fail_response(
                f"Click failed: {result.get('error', 'Unknown error')}"
            )
        
        if result.get("url"):
            self._session_url = result["url"]
        
        return self.success_response({
            "action": result.get("action", ""),
            "url": result.get("url", ""),
            "title": result.get("title", "")
        })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_input",
            "description": (
                "Type text into an input field or textarea on the page. "
                "Get element indices from browser_navigate_to first."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "element_index": {
                        "type": "integer",
                        "description": "Zero-based index of the input element"
                    },
                    "text": {
                        "type": "string",
                        "description": "Text to type into the field"
                    },
                    "url": {
                        "type": "string",
                        "description": "Optional URL to navigate to before typing"
                    }
                },
                "required": ["element_index", "text"]
            }
        }
    })
    async def browser_input(
        self,
        element_index: int,
        text: str,
        url: Optional[str] = None
    ) -> ToolResult:
        params = {"element_index": element_index, "text": text}
        if url:
            params["url"] = url
        elif self._session_url:
            params["url"] = self._session_url
        else:
            return self.fail_response("No current page. Call browser_navigate_to first.")
        
        result = await self._run_playwright("input", params)
        
        if not result.get("success"):
            return self.fail_response(
                f"Input failed: {result.get('error', 'Unknown error')}"
            )
        
        return self.success_response(result.get("action", "Text entered"))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_scroll",
            "description": "Scroll the page up or down to reveal more content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["down", "up"],
                        "description": "Scroll direction"
                    },
                    "amount": {
                        "type": "integer",
                        "description": "Pixels to scroll (default: 500)",
                        "default": 500
                    }
                },
                "required": ["direction"]
            }
        }
    })
    async def browser_scroll(
        self,
        direction: str = "down",
        amount: int = 500
    ) -> ToolResult:
        if not self._session_url:
            return self.fail_response("No current page. Call browser_navigate_to first.")
        
        result = await self._run_playwright("scroll", {
            "url": self._session_url,
            "direction": direction,
            "amount": amount
        })
        
        if not result.get("success"):
            return self.fail_response(
                f"Scroll failed: {result.get('error', 'Unknown error')}"
            )
        
        return self.success_response(result.get("action", f"Scrolled {direction}"))

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_find",
            "description": (
                "Search for specific text on the current page and scroll to it. "
                "Returns the context around the found text."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Text to search for (case-insensitive)"
                    }
                },
                "required": ["keyword"]
            }
        }
    })
    async def browser_find(self, keyword: str) -> ToolResult:
        if not self._session_url:
            return self.fail_response("No current page. Call browser_navigate_to first.")
        
        result = await self._run_playwright("find", {
            "url": self._session_url,
            "keyword": keyword
        })
        
        if not result.get("success"):
            return self.fail_response(
                f"Find failed: {result.get('error', 'Unknown error')}"
            )
        
        if result.get("found"):
            return self.success_response({
                "found": True,
                "keyword": keyword,
                "context": result.get("text", ""),
                "element_tag": result.get("tag", "")
            })
        else:
            return self.success_response({
                "found": False,
                "keyword": keyword,
                "message": f"'{keyword}' not found on current page"
            })

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_get_state",
            "description": "Get the current browser state: active URL and session info.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    })
    async def browser_get_state(self) -> ToolResult:
        return self.success_response({
            "current_url": self._session_url or "No page loaded",
            "citations": self._citations,
            "total_pages_visited": self._citation_counter
        })
