import asyncio
import json
import os
import sys
from pathlib import Path

# Add server to path
server_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(server_root))

from websockets.asyncio.client import connect
from src.tools.registry import tool_registry

async def test_tools_direct():
    print("\n--- 1. Testing Computer Tools Directly ---")
    
    # Test bash tool in D:/developer
    res = await tool_registry.execute_tool("run_bash", {"command": "Write-Output 'Hello from Koko AI!'", "working_dir": "D:/developer"})
    print(f"run_bash: status={res.get('status')}, stdout={res.get('stdout')}")
    assert res.get("status") == "success", f"run_bash failed: {res}"
    assert "Hello from Koko AI!" in res.get("stdout", "")

    # Test list_directory in D:/developer
    r_list = await tool_registry.execute_tool("list_directory", {"path": "D:/developer"})
    print(f"list_directory in D:/developer: status={r_list.get('status')}, entries={r_list.get('total_entries')}")
    assert r_list.get("status") == "success", f"list_directory failed: {r_list}"

    # Test read_file in D:/developer/koko/server/.env
    r_read = await tool_registry.execute_tool("read_file", {"path": "D:/developer/koko/server/.env"})
    print(f"read_file: status={r_read.get('status')}, bytes={r_read.get('bytes')}")
    assert r_read.get("status") == "success", f"read_file failed: {r_read}"
    assert "COMPUTER_TOOLS_ENABLED=True" in r_read.get("content", "")

    # Test write_file & delete_file in D:/developer/koko/server/tests/
    test_file = "D:/developer/koko/server/tests/koko_perm_test.txt"
    r_write = await tool_registry.execute_tool("write_file", {"path": test_file, "content": "Full access verified!"})
    print(f"write_file: status={r_write.get('status')}")
    assert r_write.get("status") == "success"
    r_del = await tool_registry.execute_tool("delete_file", {"path": test_file})
    print(f"delete_file: status={r_del.get('status')}")
    assert r_del.get("status") == "success"

    # Test calculator tool
    res = await tool_registry.execute_tool("calculate", {"expression": "125 * 8"})
    print(f"calculate: status={res.get('status')}, result={res.get('result')}")
    assert res.get("status") == "success" and res.get("result") == 1000

    # Test time tool
    res = await tool_registry.execute_tool("get_current_time", {"location": "Tokyo"})
    print(f"get_current_time: status={res.get('status')}, time_12h={res.get('time_12h')}")
    assert res.get("status") == "success"

    print("Direct computer and built-in tool tests with D:/developer/ PASSED.")

async def test_websocket_server():
    print("\n--- 2. Testing WebSocket Server Connection ---")
    uri = "ws://127.0.0.1:8765"
    
    async with connect(uri) as ws:
        # First message received is initial config
        init_msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
        config = json.loads(init_msg)
        print(f"Initial config received: assistant_name='{config.get('assistant_name')}', provider='{config.get('llm_provider')}'")
        assert config.get("assistant_name") == "Koko AI", f"Expected 'Koko AI' but got {config.get('assistant_name')}"
        assert "mistral" in config.get("api_keys_configured", {}), "Expected mistral in api_keys_configured"
        print(f"api_keys_configured: {config.get('api_keys_configured')}")

        # Test request get_config
        await ws.send(json.dumps({"type": "get_config"}))
        cfg_resp = await asyncio.wait_for(ws.recv(), timeout=5.0)
        cfg_data = json.loads(cfg_resp)
        assert cfg_data.get("type") == "config" or "available_tools" in cfg_data
        print("get_config request confirmed.")

        # Test sending chat message with Mistral
        print("\n--- 3. Testing Chat Message & Stream with Mistral ---")
        prompt = "Hello Koko! Tell me what is 50 + 50 using calculator, reply in one short tsundere sentence!"
        await ws.send(json.dumps({
            "type": "chat_message",
            "text": prompt,
            "provider": "mistral",
            "model": "ministral-8b-latest",
            "tools_enabled": True,
        }))

        received_events = []
        timeout = 25.0
        start = asyncio.get_running_loop().time()

        while asyncio.get_running_loop().time() - start < timeout:
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                if isinstance(msg, bytes):
                    print(f"[Binary Audio Packet] received {len(msg)} bytes")
                    received_events.append("audio_binary")
                    continue

                event = json.loads(msg)
                etype = event.get("type")
                received_events.append(etype)
                if etype in ("tool_start", "tool_end"):
                    print(f"[{etype}] tool={event.get('tool_name') or event.get('tool')}")
                elif etype == "speech_segment":
                    print(f"[Speech Segment] emotion={event.get('emotion')}, text='{event.get('text')}'")
                elif etype in ("transcript", "turn_end"):
                    print(f"[{etype}] {event}")
                    if etype == "turn_end":
                        break
            except asyncio.TimeoutError:
                break

        print(f"\nAll received event types: {received_events}")
        assert "turn_end" in received_events or "speech_segment" in received_events or "thinking_start" in received_events, "No conversation events received!"
        print("Live chat conversation test PASSED!")

async def main():
    await test_tools_direct()
    await test_websocket_server()
    print("\nALL SERVER & CONNECTION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(main())
