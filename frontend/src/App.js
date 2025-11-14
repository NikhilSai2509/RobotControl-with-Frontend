import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

function App() {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const robotPartsRef = useRef([]);
  const animationIdRef = useRef(null);
  const wsRef = useRef(null);

  const [jointAngles, setJointAngles] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [targetAngles, setTargetAngles] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [isMoving, setIsMoving] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Connecting...');

  const jointLimits = [
    { min: -170, max: 170, name: "Joint 1 (Base)" },
    { min: -120, max: 120, name: "Joint 2" },
    { min: -170, max: 170, name: "Joint 3" },
    { min: -120, max: 120, name: "Joint 4" },
    { min: -170, max: 170, name: "Joint 5" },
    { min: -120, max: 120, name: "Joint 6" },
    { min: -175, max: 175, name: "Joint 7 (EE)" }
  ];

  const createRobotArm = useCallback((scene) => {
    const parts = [];

    // Base (larger, more substantial)
    const baseGeometry = new THREE.CylinderGeometry(0.6, 0.7, 0.4, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2196f3,
      shininess: 30
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.2;
    scene.add(base);
    parts.push({ mesh: base, axis: 'y', joint: 0, baseHeight: 0.2 });

    // Link 1 - First vertical segment (Joint 1)
    const link1Geometry = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 16);
    const link1Material = new THREE.MeshPhongMaterial({ 
      color: 0xff9800,
      shininess: 30
    });
    const link1 = new THREE.Mesh(link1Geometry, link1Material);
    link1.position.set(0, 1.0, 0);
    scene.add(link1);
    parts.push({ mesh: link1, axis: 'z', joint: 1 });

    // Link 2 - Second segment (Joint 2)
    const link2Geometry = new THREE.CylinderGeometry(0.18, 0.18, 1.1, 16);
    const link2Material = new THREE.MeshPhongMaterial({ 
      color: 0x4caf50,
      shininess: 30
    });
    const link2 = new THREE.Mesh(link2Geometry, link2Material);
    link2.position.set(0, 2.15, 0);
    scene.add(link2);
    parts.push({ mesh: link2, axis: 'z', joint: 2 });

    // Link 3 - Third segment (Joint 3)
    const link3Geometry = new THREE.CylinderGeometry(0.16, 0.16, 1.0, 16);
    const link3Material = new THREE.MeshPhongMaterial({ 
      color: 0x9c27b0,
      shininess: 30
    });
    const link3 = new THREE.Mesh(link3Geometry, link3Material);
    link3.position.set(0, 3.15, 0);
    scene.add(link3);
    parts.push({ mesh: link3, axis: 'z', joint: 3 });

    // Link 4 - Fourth segment (Joint 4)
    const link4Geometry = new THREE.CylinderGeometry(0.14, 0.14, 0.9, 16);
    const link4Material = new THREE.MeshPhongMaterial({ 
      color: 0xf44336,
      shininess: 30
    });
    const link4 = new THREE.Mesh(link4Geometry, link4Material);
    link4.position.set(0, 4.05, 0);
    scene.add(link4);
    parts.push({ mesh: link4, axis: 'z', joint: 4 });

    // Link 5 - Fifth segment (Joint 5)
    const link5Geometry = new THREE.CylinderGeometry(0.12, 0.12, 0.8, 16);
    const link5Material = new THREE.MeshPhongMaterial({ 
      color: 0xe91e63,
      shininess: 30
    });
    const link5 = new THREE.Mesh(link5Geometry, link5Material);
    link5.position.set(0, 4.85, 0);
    scene.add(link5);
    parts.push({ mesh: link5, axis: 'z', joint: 5 });

    // Link 6 - Sixth segment (Joint 6)
    const link6Geometry = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 16);
    const link6Material = new THREE.MeshPhongMaterial({ 
      color: 0x00bcd4,
      shininess: 30
    });
    const link6 = new THREE.Mesh(link6Geometry, link6Material);
    link6.position.set(0, 5.55, 0);
    scene.add(link6);
    parts.push({ mesh: link6, axis: 'z', joint: 6 });

    // End effector (Joint 7)
    const effectorGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const effectorMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffeb3b,
      shininess: 60,
      emissive: 0xffeb3b,
      emissiveIntensity: 0.2
    });
    const effector = new THREE.Mesh(effectorGeometry, effectorMaterial);
    effector.position.set(0, 6.1, 0);
    scene.add(effector);
    parts.push({ mesh: effector, axis: 'y', joint: 7 });

    robotPartsRef.current = parts;
  }, []);

  const updateRobotPose = useCallback(() => {
    const parts = robotPartsRef.current;
    if (parts.length === 0) return;

    // Base rotation (Joint 0)
    parts[0].mesh.rotation.y = (jointAngles[0] * Math.PI) / 180;

    // Link 1 (Joint 1)
    parts[1].mesh.rotation.z = (jointAngles[1] * Math.PI) / 180;
    parts[1].mesh.position.set(0, 1.0, 0);
    parts[1].mesh.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (jointAngles[0] * Math.PI) / 180
    );

    // Link 2 (Joint 2)
    const joint1Rot = (jointAngles[1] * Math.PI) / 180;
    parts[2].mesh.rotation.z = joint1Rot + (jointAngles[2] * Math.PI) / 180;
    const link1End = new THREE.Vector3(
      0,
      1.0 + 1.2 * Math.cos(joint1Rot),
      1.2 * Math.sin(joint1Rot)
    );
    link1End.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      (jointAngles[0] * Math.PI) / 180
    );
    parts[2].mesh.position.copy(link1End);

    // Simplified positioning for remaining joints
    for (let i = 3; i < parts.length; i++) {
      const prevPart = parts[i - 1];
      const offset = 0.6 + (8 - i) * 0.1;
      parts[i].mesh.position.y = prevPart.mesh.position.y + offset;
      
      if (i < jointAngles.length) {
        parts[i].mesh.rotation.z = (jointAngles[i] * Math.PI) / 180;
      }
    }
  }, [jointAngles]);

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Better camera position
    const camera = new THREE.PerspectiveCamera(
      75,
      currentMount.clientWidth / currentMount.clientHeight,
      0.1,
      1000
    );
    camera.position.set(8, 4, 8);
    camera.lookAt(0, 3, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Enhanced lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight1.position.set(5, 10, 5);
    directionalLight1.castShadow = true;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    const bottomLight = new THREE.DirectionalLight(0xffffff, 0.3);
    bottomLight.position.set(0, -5, 0);
    scene.add(bottomLight);

    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    scene.add(gridHelper);

    // Add axes helper (X=red, Y=green, Z=blue)
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    createRobotArm(scene);

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate);
      updateRobotPose();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!currentMount) return;
      camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

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

      const radius = Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2);
      const angle = Math.atan2(camera.position.z, camera.position.x);
      
      const newAngle = angle - deltaX * 0.01;
      camera.position.x = radius * Math.cos(newAngle);
      camera.position.z = radius * Math.sin(newAngle);
      
      camera.position.y = Math.max(1, camera.position.y - deltaY * 0.02);
      camera.lookAt(0, 3, 0);

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomSpeed = 0.1;
      const direction = e.deltaY > 0 ? 1 : -1;
      
      camera.position.x *= (1 + direction * zoomSpeed);
      camera.position.y *= (1 + direction * zoomSpeed);
      camera.position.z *= (1 + direction * zoomSpeed);
      
      // Limit zoom
      const distance = Math.sqrt(
        camera.position.x ** 2 + 
        camera.position.y ** 2 + 
        camera.position.z ** 2
      );
      if (distance < 3) {
        camera.position.multiplyScalar(3 / distance);
      } else if (distance > 20) {
        camera.position.multiplyScalar(20 / distance);
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [createRobotArm, updateRobotPose]);

  useEffect(() => {
    console.log('=== WebSocket Effect Running ===');
    let ws = null;
    let reconnectTimeout = null;
    
    const connectWebSocket = () => {
      try {
        console.log('🔄 Attempting to connect to ws://localhost:8000/ws');
        ws = new WebSocket('ws://localhost:8000/ws');
        
        ws.onopen = () => {
          console.log('✅✅✅ CONNECTED to KUKA iiwa backend');
          setIsConnected(true);
          setStatusMessage('Connected to KUKA iiwa');
          
          const message = { type: 'get_state' };
          console.log('Sending initial message:', message);
          ws.send(JSON.stringify(message));
        };
        
        ws.onmessage = (event) => {
          console.log('📨 Received message from backend');
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'joint_state') {
              console.log('✅ Joint state update:', data.angles);
              setJointAngles(data.angles);
            }
          } catch (error) {
            console.error('❌ Error parsing message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('❌ WebSocket ERROR:', error);
          setStatusMessage('Connection Error');
          setIsConnected(false);
        };
        
        ws.onclose = (event) => {
          console.log('❌ WebSocket CLOSED', event.code, event.reason);
          setIsConnected(false);
          setStatusMessage('Disconnected - Reconnecting...');
          
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          reconnectTimeout = setTimeout(() => {
            console.log('⏰ Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        };
        
        wsRef.current = ws;
        
      } catch (error) {
        console.error('❌ Failed to create WebSocket:', error);
        setStatusMessage('Failed to Connect');
        setIsConnected(false);
      }
    };
    
    connectWebSocket();
    
    return () => {
      console.log('🧹 Cleanup: Closing WebSocket');
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, []);

  const handleJointChange = (index, value) => {
    const newAngles = [...targetAngles];
    newAngles[index] = parseFloat(value);
    setTargetAngles(newAngles);
  };

  const moveToTarget = () => {
    console.log('=== MOVE TO TARGET CLICKED ===');
    console.log('WebSocket readyState:', wsRef.current?.readyState);
    console.log('Target angles:', targetAngles);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket is OPEN, sending command to KUKA iiwa');
      setIsMoving(true);
      setStatusMessage('Moving KUKA iiwa...');
      
      wsRef.current.send(JSON.stringify({
        type: 'move',
        angles: targetAngles
      }));
      
      setTimeout(() => {
        console.log('Movement timeout complete');
        setIsMoving(false);
        setStatusMessage('Connected to KUKA iiwa');
      }, 1000);
      
    } else {
      console.warn('⚠️ WebSocket NOT OPEN - using local animation');
      setStatusMessage('Offline Mode');
      setIsMoving(true);
      
      const steps = 30;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        const t = currentStep / steps;
        
        setJointAngles(prevAngles => 
          prevAngles.map((current, i) => current + (targetAngles[i] - current) * t)
        );
        
        if (currentStep >= steps) {
          clearInterval(interval);
          setIsMoving(false);
          setStatusMessage('Disconnected');
        }
      }, 33);
    }
  };

  const resetRobot = () => {
    const homePosition = [0, 0, 0, 0, 0, 0, 0];
    setTargetAngles(homePosition);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending reset command to KUKA iiwa');
      setIsMoving(true);
      
      wsRef.current.send(JSON.stringify({
        type: 'move',
        angles: homePosition
      }));
      
      setTimeout(() => {
        setIsMoving(false);
      }, 1000);
    } else {
      setJointAngles(homePosition);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#111827', color: 'white' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        <div style={{ 
          position: 'absolute', 
          top: '1rem', 
          left: '1rem', 
          backgroundColor: 'rgba(31, 41, 55, 0.95)', 
          padding: '1rem', 
          borderRadius: '0.5rem',
          minWidth: '280px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            KUKA iiwa 7-Axis Robot
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: isConnected ? '#10b981' : '#ef4444'
            }} />
            <span style={{ fontSize: '0.875rem' }}>
              {isConnected ? 'PyBullet Connected' : 'Disconnected'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {statusMessage}
          </div>
          {isMoving && (
            <div style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.875rem', 
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <div style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: '#fbbf24'
              }} />
              Moving...
            </div>
          )}
          <div style={{ 
            marginTop: '0.75rem', 
            paddingTop: '0.75rem', 
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            color: '#9ca3af'
          }}>
            💡 <strong>Controls:</strong>
            <div style={{ marginTop: '0.25rem' }}>
              • Drag to rotate view
            </div>
            <div>
              • Scroll to zoom
            </div>
          </div>
        </div>
      </div>

      <div style={{ width: '384px', backgroundColor: '#1f2937', padding: '1.5rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>
          Control Panel
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {jointLimits.map((joint, index) => (
            <div key={index} style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem' }}>{joint.name}</label>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af', fontFamily: 'monospace' }}>
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
                style={{ width: '100%' }}
                disabled={isMoving}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                <span>{joint.min}°</span>
                <span>{joint.max}°</span>
              </div>
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                Current: <span style={{ fontFamily: 'monospace', color: '#10b981' }}>{jointAngles[index].toFixed(1)}°</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={moveToTarget}
            disabled={isMoving}
            style={{
              width: '100%',
              backgroundColor: isMoving ? '#4b5563' : '#2563eb',
              color: 'white',
              fontWeight: 600,
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.875rem'
            }}
          >
            {isMoving ? '🤖 Moving KUKA iiwa...' : '▶️ Move to Target'}
          </button>
          <button
            onClick={resetRobot}
            disabled={isMoving}
            style={{
              width: '100%',
              backgroundColor: isMoving ? '#6b7280' : '#4b5563',
              color: 'white',
              fontWeight: 600,
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: isMoving ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              fontSize: '0.875rem'
            }}
          >
            🔄 Reset Position
          </button>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Quick Positions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <button 
              onClick={() => setTargetAngles([0, 45, 0, -45, 0, 45, 0])} 
              disabled={isMoving} 
              style={{ 
                backgroundColor: '#374151', 
                padding: '0.5rem 0.75rem', 
                borderRadius: '0.25rem', 
                border: 'none', 
                color: 'white', 
                fontSize: '0.875rem', 
                cursor: isMoving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Position 1
            </button>
            <button 
              onClick={() => setTargetAngles([90, -30, 45, 60, -45, -30, 90])} 
              disabled={isMoving} 
              style={{ 
                backgroundColor: '#374151', 
                padding: '0.5rem 0.75rem', 
                borderRadius: '0.25rem', 
                border: 'none', 
                color: 'white', 
                fontSize: '0.875rem', 
                cursor: isMoving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Position 2
            </button>
            <button 
              onClick={() => setTargetAngles([-90, 60, -30, -90, 90, 60, -90])} 
              disabled={isMoving} 
              style={{ 
                backgroundColor: '#374151', 
                padding: '0.5rem 0.75rem', 
                borderRadius: '0.25rem', 
                border: 'none', 
                color: 'white', 
                fontSize: '0.875rem', 
                cursor: isMoving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Position 3
            </button>
            <button 
              onClick={() => setTargetAngles([0, 90, 0, -90, 0, 90, 0])} 
              disabled={isMoving} 
              style={{ 
                backgroundColor: '#374151', 
                padding: '0.5rem 0.75rem', 
                borderRadius: '0.25rem', 
                border: 'none', 
                color: 'white', 
                fontSize: '0.875rem', 
                cursor: isMoving ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              Home Up
            </button>
          </div>
        </div>

        <div style={{ 
          marginTop: '1.5rem', 
          backgroundColor: '#374151', 
          padding: '1rem', 
          borderRadius: '0.5rem', 
          fontSize: '0.875rem' 
        }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Instructions</h3>
          <ul style={{ color: '#d1d5db', lineHeight: '1.5', paddingLeft: '1rem', margin: 0 }}>
            <li>Drag in viewport to rotate camera</li>
            <li>Scroll wheel to zoom in/out</li>
            <li>Adjust sliders to set target angles</li>
            <li>Click "Move to Target" to execute</li>
            <li>Use quick positions for demos</li>
            <li style={{ marginTop: '0.5rem', color: isConnected ? '#10b981' : '#fbbf24' }}>
              {isConnected ? '✓ Real-time sync with PyBullet KUKA iiwa' : '⚠ Using local visualization'}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;