import asyncio
import os
from dotenv import load_dotenv
import litellm

load_dotenv("backend/.env")
api_key = os.getenv("DASHSCOPE_API_KEY")

async def test_provider(provider_model, name):
    print(f"--- Testing {name} ---")
    try:
        response = await litellm.acompletion(
            model=provider_model,
            messages=[{"role": "user", "content": "hi"}],
            api_key=api_key
        )
        print(f"SUCCESS: {name} responded: {response.choices[0].message.content[:50]}...")
    except Exception as e:
        print(f"FAILED: {name}: {e}")

async def run_tests():
    await test_provider("dashscope/qwen-plus", "DashScope (Qwen)")
    print("\n")
    await test_provider("moonshot/moonshot-v1", "Moonshot (Kimi)")

if __name__ == "__main__":
    asyncio.run(run_tests())
