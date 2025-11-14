import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';

const RobotControl = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const robotPartsRef = useRef([]);
  const animationIdRef = useRef(null);

  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [targetAngles, setTargetAngles] = useState([0, 0, 0, 0, 0, 0]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const wsRef = useRef(null);

  // Joint limits (in degrees)
  const jointLimits = [
    { min: -180, max: 180, name: "Base" },
    { min: -90, max: 90, name: "Shoulder" },
    { min: -135, max: 135, name: "Elbow" },
    { min: -180, max: 180, name: "Wrist 1" },
    { min: -135, max: 135, name: "Wrist 2" },
    { min: -180, max: 180, name: "Wrist 3" }
  ];

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(5, 5, 5);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    scene.add(directionalLight);

    // Grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Create robot arm
    createRobotArm(scene);

    // Animation loop
    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      updateRobotPose();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Mouse controls for camera
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    const onMouseDown = (e) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      const radius = Math.sqrt(
        camera.position.x ** 2 + camera.position.z ** 2
      );
      const angle = Math.atan2(camera.position.z, camera.position.x);
      
      const newAngle = angle - deltaX * 0.01;
      camera.position.x = radius * Math.cos(newAngle);
      camera.position.z = radius * Math.sin(newAngle);
      
      camera.position.y = Math.max(1, camera.position.y - deltaY * 0.02);
      camera.lookAt(0, 2, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Create robot arm geometry
  const createRobotArm = (scene) => {
    const parts = [];

    // Base
    const baseGeometry = new THREE.CylinderGeometry(0.5, 0.6, 0.3, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x2196f3 });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.15;
    scene.add(base);
    parts.push({ mesh: base, axis: 'y', joint: 0 });

    // Link 1 (Shoulder)
    const link1Geometry = new THREE.CylinderGeometry(0.15, 0.15, 1.5, 16);
    const link1Material = new THREE.MeshPhongMaterial({ color: 0xff9800 });
    const link1 = new THREE.Mesh(link1Geometry, link1Material);
    link1.position.set(0, 1.05, 0);
    scene.add(link1);
    parts.push({ mesh: link1, axis: 'z', joint: 1, parent: base });

    // Link 2 (Elbow)
    const link2Geometry = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 16);
    const link2Material = new THREE.MeshPhongMaterial({ color: 0x4caf50 });
    const link2 = new THREE.Mesh(link2Geometry, link2Material);
    link2.position.set(0, 2.4, 0);
    scene.add(link2);
    parts.push({ mesh: link2, axis: 'z', joint: 2, parent: link1 });

    // Link 3 (Wrist 1)
    const link3Geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.8, 16);
    const link3Material = new THREE.MeshPhongMaterial({ color: 0x9c27b0 });
    const link3 = new THREE.Mesh(link3Geometry, link3Material);
    link3.position.set(0, 3.4, 0);
    scene.add(link3);
    parts.push({ mesh: link3, axis: 'z', joint: 3, parent: link2 });

    // Link 4 (Wrist 2)
    const link4Geometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 16);
    const link4Material = new THREE.MeshPhongMaterial({ color: 0xf44336 });
    const link4 = new THREE.Mesh(link4Geometry, link4Material);
    link4.position.set(0, 4.05, 0);
    scene.add(link4);
    parts.push({ mesh: link4, axis: 'x', joint: 4, parent: link3 });

    // End effector
    const effectorGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const effectorMaterial = new THREE.MeshPhongMaterial({ color: 0xffeb3b });
    const effector = new THREE.Mesh(effectorGeometry, effectorMaterial);
    effector.position.set(0, 4.5, 0);
    scene.add(effector);
    parts.push({ mesh: effector, axis: 'y', joint: 5, parent: link4 });

    robotPartsRef.current = parts;
  };

  // Update robot pose based on joint angles
  const updateRobotPose = () => {
    const parts = robotPartsRef.current;
    if (parts.length === 0) return;

    // Simple forward kinematics visualization
    // Base rotation
    parts[0].mesh.rotation.y = (jointAngles[0] * Math.PI) / 180;

    // Shoulder
    parts[1].mesh.rotation.z = (jointAngles[1] * Math.PI) / 180;
    parts[1].mesh.position.x = 0;
    parts[1].mesh.position.y = 1.05;
    parts[1].mesh.position.z = 0;
    parts[1].mesh.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (jointAngles[0] * Math.PI) / 180
    );

    // Elbow
    const shoulderRot = (jointAngles[1] * Math.PI) / 180;
    parts[2].mesh.rotation.z = shoulderRot + (jointAngles[2] * Math.PI) / 180;
    const link1End = new THREE.Vector3(
      0,
      1.05 + 1.5 * Math.cos(shoulderRot),
      1.5 * Math.sin(shoulderRot)
    );
    link1End.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (jointAngles[0] * Math.PI) / 180
    );
    parts[2].mesh.position.copy(link1End);

    // Simplified positions for remaining joints
    for (let i = 3; i < parts.length; i++) {
      const prevPart = parts[i - 1];
      parts[i].mesh.position.y = prevPart.mesh.position.y + 0.6;
    }
  };

  // WebSocket connection (mock for demo)
  const connectWebSocket = () => {
    // In production, connect to ws://localhost:8000/ws
    setIsConnected(true);
    // Mock WebSocket updates
  };

  const handleJointChange = (index, value) => {
    const newAngles = [...targetAngles];
    newAngles[index] = parseFloat(value);
    setTargetAngles(newAngles);
  };

  const moveToTarget = () => {
    setIsMoving(true);
    // Smooth interpolation
    const steps = 30;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      const t = currentStep / steps;
      
      const newAngles = jointAngles.map((current, i) => {
        return current + (targetAngles[i] - current) * t;
      });
      
      setJointAngles(newAngles);
      
      if (currentStep >= steps) {
        clearInterval(interval);
        setIsMoving(false);
      }
    }, 33);
  };

  const resetRobot = () => {
    setTargetAngles([0, 0, 0, 0, 0, 0]);
    setJointAngles([0, 0, 0, 0, 0, 0]);
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* 3D Visualization */}
      <div className="flex-1 relative">
        <div ref={mountRef} className="w-full h-full" />
        <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg">
          <h2 className="text-xl font-bold mb-2">6-Axis Robot Arm</h2>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
          {isMoving && (
            <div className="mt-2 text-sm text-yellow-400">Moving...</div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-96 bg-gray-800 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">Control Panel</h2>

        {/* Joint Controls */}
        <div className="space-y-4 mb-6">
          {jointLimits.map((joint, index) => (
            <div key={index} className="bg-gray-700 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <label className="font-semibold">{joint.name}</label>
                <span className="text-sm text-gray-400">
                  {targetAngles[index].toFixed(1)}°
                </span>
              </div>
              <input
                type="range"
                min={joint.min}
                max={joint.max}
                step="1"
                value={targetAngles[index]}
                onChange={(e) => handleJointChange(index, e.target.value)}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                disabled={isMoving}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{joint.min}°</span>
                <span>{joint.max}°</span>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                Current: {jointAngles[index].toFixed(1)}°
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={moveToTarget}
            disabled={isMoving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {isMoving ? 'Moving...' : 'Move to Target'}
          </button>
          <button
            onClick={resetRobot}
            disabled={isMoving}
            className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Reset Position
          </button>
        </div>

        {/* Quick Positions */}
        <div className="mt-6">
          <h3 className="font-semibold mb-3">Quick Positions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTargetAngles([0, 45, -45, 0, 45, 0])}
              disabled={isMoving}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 py-2 px-3 rounded text-sm"
            >
              Position 1
            </button>
            <button
              onClick={() => setTargetAngles([90, -30, 60, 45, -45, 90])}
              disabled={isMoving}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 py-2 px-3 rounded text-sm"
            >
              Position 2
            </button>
            <button
              onClick={() => setTargetAngles([-90, 60, -90, -45, 90, -90])}
              disabled={isMoving}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 py-2 px-3 rounded text-sm"
            >
              Position 3
            </button>
            <button
              onClick={() => setTargetAngles([180, 0, 0, 90, 0, 180])}
              disabled={isMoving}
              className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 py-2 px-3 rounded text-sm"
            >
              Position 4
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-gray-700 p-4 rounded-lg text-sm">
          <h3 className="font-semibold mb-2">Instructions</h3>
          <ul className="space-y-1 text-gray-300">
            <li>• Drag in the viewport to rotate camera</li>
            <li>• Adjust sliders to set target angles</li>
            <li>• Click "Move to Target" to execute</li>
            <li>• Use quick positions for demos</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RobotControl;