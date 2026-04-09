from openai import OpenAI
import os

client = OpenAI(
    api_key="sk-3cd7277939384181b97d9df33d02047f",
    base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
)

try:
    completion = client.chat.completions.create(
        model="qwen3.5-flash",
        messages=[{"role": "user", "content": "hi"}]
    )
    print("SUCCESS: " + completion.choices[0].message.content)
except Exception as e:
    print("FAILED: " + str(e))
