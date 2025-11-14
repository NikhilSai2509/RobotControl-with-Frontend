import pytest
from fastapi.testclient import TestClient
from main import app, robot
import numpy as np

client = TestClient(app)

def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "running"

def test_get_joint_states():
    response = client.get("/joint_states")
    assert response.status_code == 200
    data = response.json()
    assert "angles" in data
    assert len(data["angles"]) == 6

def test_move_joints():
    test_angles = [0, 30, -45, 0, 45, 0]
    response = client.post("/move_joints", json={
        "angles": test_angles,
        "smooth": False
    })
    assert response.status_code == 200
    assert response.json()["success"] == True

def test_reset_robot():
    response = client.post("/reset")
    assert response.status_code == 200
    assert response.json()["success"] == True

def test_joint_limits():
    # Test that angles are clamped to limits
    extreme_angles = [200, 100, -200, 200, -200, 200]
    robot.set_joint_angles([np.radians(a) for a in extreme_angles])
    
    current = robot.get_joint_states()
    for i, angle in enumerate(current):
        min_limit, max_limit = robot.joint_limits[i]
        assert min_limit <= angle <= max_limit

def test_smooth_trajectory():
    start = [0.0] * 6
    target = [np.radians(45)] * 6
    
    trajectory = robot.smooth_move(target, steps=10)
    assert len(trajectory) == 11  # steps + 1
    
    # Check interpolation
    assert np.allclose(trajectory[0], start, atol=1e-6)
    assert np.allclose(trajectory[-1], target, atol=1e-6)