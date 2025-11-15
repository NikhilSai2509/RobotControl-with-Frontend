"""Robot simulation controller using PyBullet.

This module contains the RobotController class and a global `robot`
instance used by the API layer.
"""
from typing import List, Dict
import pybullet as p
import pybullet_data
import numpy as np


class RobotController:
    def __init__(self):
        self.physics_client = None
        self.robot_id = None
        self.controllable_joints = []
        self.num_joints = 7  # KUKA iiwa has 7 joints
        self.joint_limits = []
        self.current_angles = []
        self.boxes = []  # Track boxes for synchronization
        self.initialize_simulation()

    def initialize_simulation(self):
        """Initialize PyBullet simulation"""
        print("\033[92m Initializing PyBullet simulation... \033[0m")

        # Using DIRECT mode for headless server by default
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

    def create_box(self, size=(0.4, 0.4, 0.4), mass=1.0, position=(0.5, 0.5, 0.2)):
        """Create a box in the simulation"""
        half_extents = [s / 2.0 for s in size]
        col = p.createCollisionShape(p.GEOM_BOX, halfExtents=half_extents)
        vis = p.createVisualShape(p.GEOM_BOX, halfExtents=half_extents, rgbaColor=[0.9, 0.2, 0.2, 1])
        body = p.createMultiBody(baseMass=mass, baseCollisionShapeIndex=col, baseVisualShapeIndex=vis, basePosition=position)
        print(f"\033[92m Created box (ID: {body}) at position {position} \033[0m")

        # Store box info for frontend sync
        box_info = {
            "id": body,
            "position": position,
            "size": size,
            "color": [0.9, 0.2, 0.2, 1]
        }
        self.boxes.append(box_info)
        return body

    def get_box_position(self, box_id):
        """Get transformed box position for frontend (applies rotation)"""
        pos, orn = p.getBasePositionAndOrientation(box_id)
        # Transform from PyBullet coords (Z-up) to Three.js frontend coords (Y-up with -90deg X rotation)
        # PyBullet: (x, y, z) -> Three.js: (x, z, -y)
        transformed_pos = [pos[0], pos[2], -pos[1]]
        return transformed_pos

    def clear_boxes(self):
        """Remove all boxes from the simulation"""
        for box_info in self.boxes:
            p.removeBody(box_info["id"])
            print(f"\033[92m Removed box (ID: {box_info['id']}) \033[0m")
        self.boxes = []
        print(f"\033[92m All boxes cleared \033[0m")

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
