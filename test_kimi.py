#!/usr/bin/env python3
"""Test Kimi (Moonshot) model via API"""

import os
import requests

# Configuration (trying the .ai base URL)
KIMI_API_KEY = "sk-X6Uk5gHDHEvUr974MYSc6l1Oil1fqdQRTeYz2NmsZW7iv527"
KIMI_API_BASE = "https://api.moonshot.ai/v1"

# Test
url = f"{KIMI_API_BASE}/chat/completions"
headers = {
    "Authorization": f"Bearer {KIMI_API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": "kimi-k2-0905-preview",
    "messages": [
        {"role": "user", "content": "Bonjour! Réponds juste 'Kimi K2 est active' si tu fonctionnes bien."}
    ],
    "max_tokens": 50
}

print("=== Test de Kimi (Moonshot) ===")
print(f"URL: {url}")
print(f"Model: moonshot-v1-8k\n")

try:
    response = requests.post(url, headers=headers, json=data, timeout=30)
    print(f"Status Code: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("[OK] Succès!")
        print(f"\nRéponse du modèle:")
        print(result['choices'][0]['message']['content'])
    else:
        print(f"[ERROR] Erreur {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"[ERROR] Exception: {e}")
