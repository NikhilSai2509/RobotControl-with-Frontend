import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8000/ws"
    print(f"Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            
            # Request state
            await websocket.send(json.dumps({"type": "get_state"}))
            print("📤 Sent get_state request")
            
            # Receive response
            response = await websocket.recv()
            print(f"📥 Received: {response}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

asyncio.run(test())
