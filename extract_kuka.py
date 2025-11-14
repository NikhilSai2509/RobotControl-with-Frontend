import pybullet as p
import pybullet_data
import shutil
import os
from robot_descriptions import panda_description
# Get PyBullet data path
data_path = pybullet_data.getDataPath()
kuka_path = panda_description.URDF_PATH

print(f"PyBullet data path: {data_path}")
print(f"KUKA path: {kuka_path}")

# Create output directory
output_path = "/home/nikhilsai/kuka_iiwa"
os.makedirs(output_path, exist_ok=True)

# Copy KUKA directory
if os.path.exists(kuka_path):
    shutil.copytree(kuka_path, os.path.join(output_path, "kuka_iiwa"), dirs_exist_ok=True)
    print(f"✅ Copied KUKA files to {output_path}")
    
    # List files
    for root, dirs, files in os.walk(output_path):
        for file in files:
            filepath = os.path.join(root, file)
            print(f"  - {filepath}")
else:
    print(f"❌ KUKA path not found: {kuka_path}")
