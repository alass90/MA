import litellm
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")
api_key = os.getenv("DASHSCOPE_API_KEY")
base_url = os.getenv("DASHSCOPE_API_BASE")

async def test_qvq(model_id):
    print(f"--- Testing {model_id} ---")
    try:
        response = await litellm.acompletion(
            model=model_id,
            messages=[{"role": "user", "content": "hi"}],
            api_key=api_key,
            api_base=base_url,
            custom_llm_provider="dashscope"
        )
        print(f"SUCCESS: {response.choices[0].message.content[:50]}")
    except Exception as e:
        print(f"FAILED: {e}")

import asyncio
if __name__ == "__main__":
    # Test different formats
    asyncio.run(test_qvq("dashscope/qvq-max-2025-03-25"))
    asyncio.run(test_qvq("dashscope/qvq-max"))
