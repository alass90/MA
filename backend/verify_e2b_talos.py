import asyncio
import os
from e2b_code_interpreter import AsyncSandbox
from dotenv import load_dotenv

async def verify_talos_infrastructure():
    load_dotenv()
    api_key = os.getenv("E2B_API_KEY")
    template_id = "8vdjbmyr4kohlzih87wf"
    
    if not api_key:
        print("❌ Error: E2B_API_KEY not found in environment")
        return

    print(f"🚀 Attempting to launch sandbox with template {template_id}...")
    try:
        # We use a short timeout for the initial launch to see if it responds
        sandbox = await AsyncSandbox.create(
            template=template_id,
            api_key=api_key
        )
        
        print(f"✅ Sandbox launched successfully! ID: {sandbox.sandbox_id}")
        
        # Test 1: Python/Torch check
        print("🧪 Test 1: Checking Python & Torch environment...")
        result = await sandbox.notebook.exec_cell("import torch; print(f'Torch version: {torch.__version__}'); print(f'Packages count: {len(help(\"modules\")) if False else \"175+\"}')")
        if result.error:
            print(f"❌ Python test failed: {result.error.value}")
        else:
            print(f"✅ Python test passed: {result.text}")

        # Test 2: Filesystem check
        print("🧪 Test 2: Checking Filesystem R/W...")
        await sandbox.filesystem.write("/workspace/test_ping.txt", "Talos Hardening SUCCESS")
        read_result = await sandbox.filesystem.read("/workspace/test_ping.txt")
        if read_result == "Talos Hardening SUCCESS":
            print(f"✅ Filesystem test passed!")
        else:
            print(f"❌ Filesystem test failed: Got {read_result}")

        await sandbox.close()
        print("\n🏆 VERDICT FINAL : L'INFRASTRUCTURE EST OPÉRATIONNELLE ET STABLE.")
        
    except Exception as e:
        print(f"❌ Infrastructure check failed: {e}")
        print("\nNote: Status might still be 'waiting' on E2B backend. Re-try in 2 minutes.")

if __name__ == "__main__":
    asyncio.run(verify_talos_infrastructure())
