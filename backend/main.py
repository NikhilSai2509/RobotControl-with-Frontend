# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pybullet as p
import pybullet_data
import numpy as np
import asyncio
import json
from typing import List, Dict
import time

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RobotController:
    def __init__(self):
        self.physics_client = None
        self.robot_id = None
        self.num_joints = 6
        self.joint_limits = [
            (-np.pi, np.pi),      # Base
            (-np.pi/2, np.pi/2),  # Shoulder
            (-3*np.pi/4, 3*np.pi/4),  # Elbow
            (-np.pi, np.pi),      # Wrist 1
            (-3*np.pi/4, 3*np.pi/4),  # Wrist 2
            (-np.pi, np.pi),      # Wrist 3
        ]
        self.current_angles = [0.0] * self.num_joints
        self.initialize_simulation()
    
    def initialize_simulation(self):
        """Initialize PyBullet simulation"""
        # Use DIRECT mode for headless server
        self.physics_client = p.connect(p.DIRECT)
        p.setAdditionalSearchPath(pybullet_data.getDataPath())
        p.setGravity(0, 0, -9.81)
        
        # Load plane
        p.loadURDF("plane.urdf")
        
        # Create robot from URDF (or create programmatically)
        self.robot_id = self.create_robot_urdf()
        
    def create_robot_urdf(self):
        """Create a simple 6-axis robot arm programmatically"""
        # For demo, using KUKA arm as placeholder
        # In production, load your custom URDF
        try:
            robot = p.loadURDF("kuka_iiwa/model.urdf", [0, 0, 0], useFixedBase=True)
            return robot
        except:
            # Fallback: create simple robot
            return self.create_simple_robot()
    
    def create_simple_robot(self):
        """Create a simple robot arm using shapes"""
        # Create base
        base_collision = p.createCollisionShape(p.GEOM_CYLINDER, radius=0.5, height=0.3)
        base_visual = p.createVisualShape(p.GEOM_CYLINDER, radius=0.5, length=0.3, 
                                          rgbaColor=[0.1, 0.5, 0.8, 1])
        base = p.createMultiBody(baseMass=1, baseCollisionShapeIndex=base_collision,
                                baseVisualShapeIndex=base_visual, basePosition=[0, 0, 0.15])
        return base
    
    def get_joint_states(self) -> List[float]:
        """Get current joint angles"""
        if self.robot_id is None:
            return self.current_angles
        
        joint_states = []
        for i in range(p.getNumJoints(self.robot_id)):
            joint_info = p.getJointState(self.robot_id, i)
            joint_states.append(joint_info[0])  # Joint position
        
        return joint_states[:self.num_joints]
    
    def set_joint_angles(self, angles: List[float]):
        """Set target joint angles with limits checking"""
        for i, angle in enumerate(angles[:self.num_joints]):
            # Clamp to limits
            min_limit, max_limit = self.joint_limits[i]
            clamped = np.clip(angle, min_limit, max_limit)
            self.current_angles[i] = clamped
            
            if self.robot_id is not None and i < p.getNumJoints(self.robot_id):
                p.setJointMotorControl2(
                    self.robot_id,
                    i,
                    p.POSITION_CONTROL,
                    targetPosition=clamped,
                    force=500
                )
    
    def smooth_move(self, target_angles: List[float], steps: int = 50):
        """Generate smooth interpolation between current and target angles"""
        start_angles = self.get_joint_states()
        trajectory = []
        
        for step in range(steps + 1):
            t = step / steps
            interpolated = [
                start + (target - start) * t
                for start, target in zip(start_angles, target_angles)
            ]
            trajectory.append(interpolated)
        
        return trajectory
    
    def get_end_effector_pose(self) -> Dict:
        """Get end effector position and orientation"""
        if self.robot_id is None:
            return {"position": [0, 0, 0], "orientation": [0, 0, 0, 1]}
        
        # Get last link state
        num_joints = p.getNumJoints(self.robot_id)
        if num_joints > 0:
            link_state = p.getLinkState(self.robot_id, num_joints - 1)
            return {
                "position": list(link_state[0]),
                "orientation": list(link_state[1])
            }
        
        return {"position": [0, 0, 0], "orientation": [0, 0, 0, 1]}
    
    def step_simulation(self):
        """Step the physics simulation"""
        if self.physics_client is not None:
            p.stepSimulation()

# Global robot controller
robot = RobotController()

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
    return {"message": "6-Axis Robot Control API", "status": "running"}

@app.get("/joint_states")
async def get_joint_states():
    """Get current joint angles"""
    angles = robot.get_joint_states()
    return {
        "angles": angles,
        "angles_degrees": [np.degrees(a) for a in angles]
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
                "end_effector": robot.get_end_effector_pose()
            })
    else:
        robot.set_joint_angles(angles_rad)
        robot.step_simulation()
    
    return {
        "success": True,
        "final_angles": [np.degrees(a) for a in robot.get_joint_states()]
    }

@app.post("/reset")
async def reset_robot():
    """Reset robot to home position"""
    home_position = [0.0] * robot.num_joints
    robot.set_joint_angles(home_position)
    robot.step_simulation()
    
    return {"success": True, "angles": home_position}

@app.get("/end_effector")
async def get_end_effector():
    """Get end effector pose"""
    return robot.get_end_effector_pose()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data["type"] == "move":
                angles_rad = [np.radians(a) for a in data["angles"]]
                trajectory = robot.smooth_move(angles_rad, steps=30)
                
                for angles in trajectory:
                    robot.set_joint_angles(angles)
                    robot.step_simulation()
                    
                    state = {
                        "type": "joint_state",
                        "angles": [np.degrees(a) for a in angles],
                        "end_effector": robot.get_end_effector_pose()
                    }
                    await websocket.send_json(state)
                    await asyncio.sleep(0.033)  # ~30 fps
            
            elif data["type"] == "get_state":
                state = {
                    "type": "joint_state",
                    "angles": [np.degrees(a) for a in robot.get_joint_states()],
                    "end_effector": robot.get_end_effector_pose()
                }
                await websocket.send_json(state)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)