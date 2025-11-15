# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import pybullet as p
import pybullet_data
import numpy as np
import asyncio
from typing import List, Dict

app = FastAPI()


class RobotController:
    def __init__(self):
        self.physics_client = None
        self.robot_id = None
        self.controllable_joints = []
        self.num_joints = 7  # KUKA iiwa has 7 joints
        self.joint_limits = []
        self.current_angles = []
        self.initialize_simulation()
    
    def initialize_simulation(self):
        """Initialize PyBullet simulation"""
        print("\033[92m Initializing PyBullet simulation... \033[0m") #92 green , 91 red
        
        # Using DIRECT mode for headless server
        self.physics_client = p.connect(p.DIRECT)
        p.setAdditionalSearchPath(pybullet_data.getDataPath())
        p.setGravity(0, 0, -9.81)
        
        # Load plane
        plane_id = p.loadURDF("plane.urdf")
        print(f"\033[92m Loaded ground plane (ID: {plane_id}) \033[0m")
        
        # Load KUKA iiwa robot
        self.robot_id = self.create_robot_urdf()
        
        # Configure joints
        self.configure_robot_joints()
        
        # Initialize current angles
        self.current_angles = [0.0] * self.num_joints
        
        # Set initial joint positions
        for i, joint_idx in enumerate(self.controllable_joints):
            p.resetJointState(self.robot_id, joint_idx, 0.0)
        print(f"\033[92m PyBullet simulation initialized with {self.num_joints} joints \033[0m")

    
    def create_robot_urdf(self):
        """Load KUKA iiwa robot URDF"""
        try:
            print(" Loading KUKA iiwa robot...")
            robot = p.loadURDF(
                "kuka_iiwa/model.urdf",
                [0, 0, 0],
                useFixedBase=True,
                flags=p.URDF_USE_SELF_COLLISION
            )
            print(f"\033[92m Loaded KUKA iiwa robot (ID: {robot}) \033[0m")
            
            # Get number of joints
            num_joints = p.getNumJoints(robot)
            print(f" Robot has {num_joints} total joints/links")
            
            # Print all joint info
            print("\n Joint Information:")
            for i in range(num_joints):
                joint_info = p.getJointInfo(robot, i)
                joint_name = joint_info[1].decode('utf-8')
                joint_type = joint_info[2]
                
                type_names = {
                    p.JOINT_REVOLUTE: "REVOLUTE",
                    p.JOINT_PRISMATIC: "PRISMATIC",
                    p.JOINT_SPHERICAL: "SPHERICAL",
                    p.JOINT_PLANAR: "PLANAR",
                    p.JOINT_FIXED: "FIXED"
                }
                
                print(f" Joint {i}: {joint_name:25s} Type: {type_names.get(joint_type, joint_type)}")
            
            print()
            return robot
            
        except Exception as e:
            print(f"\033[91m Error loading KUKA iiwa: {e}\033[0m")
            print("This should not happen as KUKA is already built into PyBullet")
            raise
    
    def configure_robot_joints(self):
        """Configure joints based on loaded KUKA iiwa robot"""
        if self.robot_id is None:
            return
        
        # Get controllable joints (revolute/prismatic)
        self.controllable_joints = []
        print(f"\033[92m Configuring controllable joints:\033[0m")
        for i in range(p.getNumJoints(self.robot_id)):
            joint_info = p.getJointInfo(self.robot_id, i)
            joint_type = joint_info[2]
            joint_name = joint_info[1].decode('utf-8')
            
            # Type 0 = REVOLUTE, Type 1 = PRISMATIC
            if joint_type in [p.JOINT_REVOLUTE, p.JOINT_PRISMATIC]:
                self.controllable_joints.append(i)
                
                # Get joint limits
                lower_limit = joint_info[8]  # Lower limit
                upper_limit = joint_info[9]  # Upper limit
                
                print(f"  ✓ Joint {i}: {joint_name:25s} Limits: [{np.degrees(lower_limit):.1f}°, {np.degrees(upper_limit):.1f}°]")
        
        print(f"\033[92mFound {len(self.controllable_joints)} controllable joints\n\033[0m")
        
        # Update num_joints to match real robot
        self.num_joints = len(self.controllable_joints)
        
        # KUKA iiwa joint limits (in radians)
        self.joint_limits = [
            (-2.96706, 2.96706),   # Joint 1: ±170°
            (-2.09440, 2.09440),   # Joint 2: ±120°
            (-2.96706, 2.96706),   # Joint 3: ±170°
            (-2.09440, 2.09440),   # Joint 4: ±120°
            (-2.96706, 2.96706),   # Joint 5: ±170°
            (-2.09440, 2.09440),   # Joint 6: ±120°
            (-3.05433, 3.05433),   # Joint 7: ±175°
        ]
    
    def get_joint_states(self) -> List[float]:
        """Get current joint angles in radians"""
        if self.robot_id is None or not self.controllable_joints:
            return self.current_angles
        
        joint_states = []
        for joint_idx in self.controllable_joints:
            joint_info = p.getJointState(self.robot_id, joint_idx)
            joint_states.append(joint_info[0])  # Joint position in radians
        
        return joint_states
    
    def set_joint_angles(self, angles: List[float]):
        """Set target joint angles with limits checking"""
        for i, angle in enumerate(angles[:self.num_joints]):
            if i >= len(self.controllable_joints):
                break
            
            # Clamp to limits
            if i < len(self.joint_limits):
                min_limit, max_limit = self.joint_limits[i]
                clamped = np.clip(angle, min_limit, max_limit)
            else:
                clamped = angle
            
            self.current_angles[i] = clamped
            
            joint_idx = self.controllable_joints[i]
            p.setJointMotorControl2(
                self.robot_id,
                joint_idx,
                p.POSITION_CONTROL,
                targetPosition=clamped,
                force=500,
                maxVelocity=1.0
            )
    ## Function for smooth movement
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
        if self.robot_id is None or not self.controllable_joints:
            return {"position": [0, 0, 0], "orientation": [0, 0, 0, 1]}
        
        # Get last controllable joint link (end effector)
        last_link_idx = self.controllable_joints[-1]
        link_state = p.getLinkState(self.robot_id, last_link_idx)
        
        return {
            "position": list(link_state[0]),
            "orientation": list(link_state[1])
        }
    
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
    return {
        "message": "6-Axis Robot Control API - KUKA iiwa",
        "status": "running",
        "robot": "KUKA iiwa 7-axis",
        "joints": robot.num_joints
    }

@app.get("/joint_states")
async def get_joint_states():
    """Get current joint angles"""
    angles = robot.get_joint_states()
    return {
        "angles": angles,
        "angles_degrees": [np.degrees(a) for a in angles],
        "num_joints": robot.num_joints
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

@app.get("/robot_info")
async def get_robot_info():
    """Get robot configuration info"""
    return {
        "name": "KUKA iiwa",
        "num_joints": robot.num_joints,
        "controllable_joints": robot.controllable_joints,
        "joint_limits_degrees": [
            {
                "joint": i,
                "min": np.degrees(limit[0]),
                "max": np.degrees(limit[1])
            }
            for i, limit in enumerate(robot.joint_limits)
        ]
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
            "end_effector": robot.get_end_effector_pose()
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
                        "end_effector": robot.get_end_effector_pose()
                    }
                    await websocket.send_json(state)
                    await asyncio.sleep(0.033)  # ~30 fps
                
                print(f"\033[92m Movement complete\033[0m")
            
            elif data["type"] == "get_state":
                state = {
                    "type": "joint_state",
                    "angles": [np.degrees(a) for a in robot.get_joint_states()],
                    "end_effector": robot.get_end_effector_pose()
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)