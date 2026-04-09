import asyncio
import os
from dotenv import load_dotenv

# Load env from backend/.env
load_dotenv("backend/.env")

# Mock the environment to ensure we can import core without issues
import sys
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.ai_models.registry import registry
from core.ai_models.manager import ModelManager
import litellm

async def test_qwen():
    print("--- Testing Qwen Integration ---")
    
    # Check current registry for basic model
    basic_model_id = registry.get_litellm_model_id("kortix/basic")
    print(f"Default basic model is resolved to: {basic_model_id}")
    
    if "dashscope" not in basic_model_id:
        print("ERROR: Basic model is not pointing to dashscope!")
        return

    print(f"API Base: {os.getenv('DASHSCOPE_API_BASE')}")
    print(f"API Key: {os.getenv('DASHSCOPE_API_KEY')[:10]}...")

    try:
        print("Sending request to DashScope...")
        response = await litellm.acompletion(
            model=basic_model_id,
            messages=[{"role": "user", "content": "Say hello!"}],
            api_key=os.getenv("DASHSCOPE_API_KEY"),
            api_base=os.getenv("DASHSCOPE_API_BASE")
        )
        print("\n--- Response Received ---")
        print(response.choices[0].message.content)
        print("--------------------------")
        print("SUCCESS: Qwen API is responding!")
    except Exception as e:
        print(f"\nFAILED: Error calling Qwen API: {e}")

if __name__ == "__main__":
    asyncio.run(test_qwen())
