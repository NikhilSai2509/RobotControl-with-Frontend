from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import asyncio
from typing import List, Dict

# Import robot controller
from robot import robot

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class JointAnglesRequest(BaseModel):
    angles: List[float]
    smooth: bool = True


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                pass


manager = ConnectionManager()


@app.get("/")
async def root():
    return {
        "message": "6-Axis Robot Control API - KUKA iiwa",
        "status": "running",
        "robot": "KUKA iiwa 7-axis",
        "joints": robot.num_joints,
    }


@app.get("/joint_states")
async def get_joint_states():
    """Get current joint angles"""
    angles = robot.get_joint_states()
    return {
        "angles": angles,
        "angles_degrees": [np.degrees(a) for a in angles],
        "num_joints": robot.num_joints,
    }


@app.post("/move_joints")
async def move_joints(request: JointAnglesRequest):
    """Move robot to specified joint angles"""
    # Convert degrees to radians
    angles_rad = [np.radians(a) for a in request.angles]

    if request.smooth:
        trajectory = robot.smooth_move(angles_rad)
        for angles in trajectory:
            robot.set_joint_angles(angles)
            robot.step_simulation()
            await asyncio.sleep(0.02)  # 50 Hz

            # Broadcast state
            await manager.broadcast({
                "type": "joint_state",
                "angles": [np.degrees(a) for a in angles],
                "end_effector": robot.get_end_effector_pose(),
            })
    else:
        robot.set_joint_angles(angles_rad)
        robot.step_simulation()

    return {
        "success": True,
        "final_angles": [np.degrees(a) for a in robot.get_joint_states()],
    }


@app.post("/reset")
async def reset_robot():
    """Reset robot to home position"""
    home_position = [0.0] * robot.num_joints
    robot.set_joint_angles(home_position)
    robot.step_simulation()

    return {"success": True, "angles": home_position}


@app.post("/reset_scene")
async def reset_scene():
    """Reset the entire scene - remove all boxes"""
    robot.clear_boxes()
    robot.step_simulation()
    return {"success": True, "message": "Scene cleared"}


@app.get("/end_effector")
async def get_end_effector():
    """Get end effector pose"""
    return robot.get_end_effector_pose()


@app.get("/robot_info")
async def get_robot_info():
    """Get robot configuration info"""
    return {
        "name": "KUKA iiwa",
        "num_joints": robot.num_joints,
        "controllable_joints": robot.controllable_joints,
        "joint_limits_degrees": [
            {"joint": i, "min": np.degrees(limit[0]), "max": np.degrees(limit[1])}
            for i, limit in enumerate(robot.joint_limits)
        ],
    }


@app.post("/create_box")
async def create_box_endpoint():
    """Create a new box in the simulation"""
    box_id = robot.create_box()
    robot.step_simulation()

    # Get transformed position for frontend
    transformed_pos = robot.get_box_position(box_id)

    return {
        "success": True,
        "box_id": box_id,
        "position": transformed_pos,
        "size": [0.4, 0.4, 0.4],
        "color": [0.9, 0.2, 0.2, 1],
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    print(f"\033[92m WebSocket connection attempt... \033[0m")

    try:
        await manager.connect(websocket)
        print(f"\033[92m ✓ WebSocket connected successfully!!!! \033[0m")

        # Send initial state immediately
        initial_state = {
            "type": "joint_state",
            "angles": [np.degrees(a) for a in robot.get_joint_states()],
            "end_effector": robot.get_end_effector_pose(),
        }
        await websocket.send_json(initial_state)
        print(f" Sent INITIAL state")

        while True:
            # Wait for messages from client
            data = await websocket.receive_json()
            print(f" Received from client: {data['type']}")

            if data["type"] == "move":
                print(f"\033[92m Moving KUKA iiwa to: {data['angles']} \033[0m")
                angles_rad = [np.radians(a) for a in data["angles"]]
                trajectory = robot.smooth_move(angles_rad, steps=30)

                for angles in trajectory:
                    robot.set_joint_angles(angles)
                    robot.step_simulation()

                    state = {
                        "type": "joint_state",
                        "angles": [np.degrees(a) for a in angles],
                        "end_effector": robot.get_end_effector_pose(),
                    }
                    await websocket.send_json(state)
                    await asyncio.sleep(0.033)  # ~30 fps

                print(f"\033[92m Movement complete\033[0m")

            elif data["type"] == "get_state":
                state = {
                    "type": "joint_state",
                    "angles": [np.degrees(a) for a in robot.get_joint_states()],
                    "end_effector": robot.get_end_effector_pose(),
                }
                await websocket.send_json(state)
                print(f" Sent current state")

    except WebSocketDisconnect:
        print("\033[91m WebSocket disconnected\033[0m")
        manager.disconnect(websocket)
    except Exception as e:
        print(f"\033[91m WebSocket error{e}\033[0m")
        import traceback
        traceback.print_exc()
        try:
            manager.disconnect(websocket)
        except:
            pass
