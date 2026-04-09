import asyncio
import os
from dotenv import load_dotenv
import litellm

load_dotenv("backend/.env")
litellm.set_verbose = True

async def test_qwen():
    try:
        response = await litellm.acompletion(
            model="dashscope/qwen-plus",
            messages=[{"role": "user", "content": "hi"}],
            api_key=os.getenv("DASHSCOPE_API_KEY")
        )
        print(response.choices[0].message.content)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_qwen())
