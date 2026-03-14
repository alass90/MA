#!/usr/bin/env python3
"""Test Qwen model via Dashscope API"""

import os
import requests

# Configuration
DASHSCOPE_API_KEY = "sk-bb7ac782c319478e923f63b9924d8958"
DASHSCOPE_API_BASE = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

# Test avec Qwen Plus
url = f"{DASHSCOPE_API_BASE}/chat/completions"
headers = {
    "Authorization": f"Bearer {DASHSCOPE_API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": "qwen-plus",
    "messages": [
        {"role": "user", "content": "Bonjour! Réponds juste 'OK' si tu fonctionnes bien."}
    ],
    "max_tokens": 50
}

print("=== Test de Qwen Plus via Dashscope ===")
print(f"URL: {url}")
print(f"Model: qwen-plus\n")

try:
    response = requests.post(url, headers=headers, json=data, timeout=30)
    print(f"Status Code: {response.status_code}")

    if response.status_code == 200:
        result = response.json()
        print("[OK] Succes!")
        print(f"\nReponse du modele:")
        print(result['choices'][0]['message']['content'])
    else:
        print(f"[ERROR] Erreur {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"[ERROR] Exception: {e}")
