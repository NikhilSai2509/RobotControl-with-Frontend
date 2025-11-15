import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import Scene from './components/Scene';

function App() {
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

  // WebSocket connection
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;
    
    const connectWebSocket = () => {
      try {
        console.log('🔄 Connecting to WebSocket...');
        ws = new WebSocket('ws://localhost:8000/ws');
        
        ws.onopen = () => {
          console.log('✅ Connected to PyBullet backend');
          setIsConnected(true);
          setStatusMessage('Connected to PyBullet');
          ws.send(JSON.stringify({ type: 'get_state' }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'joint_state') {
              setJointAngles(data.angles);
            }
          } catch (error) {
            console.error('WebSocket message parse error:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };
        
        ws.onclose = () => {
          console.log('WebSocket closed');
          setIsConnected(false);
          setStatusMessage('Reconnecting...');
          
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          reconnectTimeout = setTimeout(() => {
            console.log('Reconnecting...');
            connectWebSocket();
          }, 3000);
        };
        
        wsRef.current = ws;
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };
    
    connectWebSocket();
    
    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const handleJointChange = (index, value) => {
    const newAngles = [...targetAngles];
    newAngles[index] = parseFloat(value);
    setTargetAngles(newAngles);
  };

  const moveToTarget = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Sending move command:', targetAngles);
      setIsMoving(true);
      wsRef.current.send(JSON.stringify({ type: 'move', angles: targetAngles }));
      setTimeout(() => setIsMoving(false), 1000);
    } else {
      console.log('WebSocket not connected, local animation');
      setIsMoving(true);
      const steps = 30;
      let currentStep = 0;
      const interval = setInterval(() => {
        currentStep++;
        const t = currentStep / steps;
        setJointAngles(prev => 
          prev.map((curr, i) => curr + (targetAngles[i] - curr) * t)
        );
        if (currentStep >= steps) {
          clearInterval(interval);
          setIsMoving(false);
        }
      }, 33);
    }
  };

  const resetRobot = () => {
    const home = [0, 0, 0, 0, 0, 0, 0];
    setTargetAngles(home);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      setIsMoving(true);
      wsRef.current.send(JSON.stringify({ type: 'move', angles: home }));
      setTimeout(() => setIsMoving(false), 1000);
    } else {
      setJointAngles(home);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#111827', color: 'white' }}>
      {/* 3D Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: [2, 1.5, 2], fov: 60 }}
          shadows
          style={{ background: '#1a1a2e' }}
        >
          <Scene jointAngles={jointAngles} />
        </Canvas>
        
        {/* Status Overlay */}
        <div style={{ 
          position: 'absolute', 
          top: '1rem', 
          left: '1rem', 
          backgroundColor: 'rgba(31, 41, 55, 0.95)', 
          padding: '1rem', 
          borderRadius: '0.5rem',
          minWidth: '280px',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
            🤖 KUKA iiwa Robot
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ 
              width: '12px', 
              height: '12px', 
              borderRadius: '50%', 
              backgroundColor: isConnected ? '#10b981' : '#ef4444'
            }} />
            <span style={{ fontSize: '0.875rem' }}>{statusMessage}</span>
          </div>
          {isMoving && (
            <div style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.875rem' }}>
              🔄 Moving...
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div style={{ width: '384px', backgroundColor: '#1f2937', padding: '1rem', overflowY: 'auto' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Control Panel
        </h2>
        
        {jointLimits.map((joint, index) => (
          <div key={index} style={{ backgroundColor: '#374151', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
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
              Current: <span style={{ color: '#10b981', fontFamily: 'monospace' }}>{jointAngles[index].toFixed(1)}°</span>
            </div>
          </div>
        ))}

        <button 
          onClick={moveToTarget} 
          disabled={isMoving} 
          style={{ 
            width: '100%', 
            backgroundColor: isMoving ? '#4b5563' : '#2563eb', 
            color: 'white', 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            border: 'none', 
            marginBottom: '0.5rem', 
            cursor: isMoving ? 'not-allowed' : 'pointer', 
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        >
          {isMoving ? '🤖 Moving...' : '▶️ Move to Target'}
        </button>
        
        <button 
          onClick={resetRobot} 
          disabled={isMoving} 
          style={{ 
            width: '100%', 
            backgroundColor: '#4b5563', 
            color: 'white', 
            padding: '0.75rem', 
            borderRadius: '0.5rem', 
            border: 'none', 
            cursor: isMoving ? 'not-allowed' : 'pointer', 
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        >
          🔄 Reset
        </button>

        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Quick Positions</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <button onClick={() => setTargetAngles([0, 45, 0, -45, 0, 45, 0])} disabled={isMoving} style={{ backgroundColor: '#374151', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}>Pos 1</button>
            <button onClick={() => setTargetAngles([90, -30, 45, 60, -45, -30, 90])} disabled={isMoving} style={{ backgroundColor: '#374151', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}>Pos 2</button>
            <button onClick={() => setTargetAngles([-90, 60, -30, -90, 90, 60, -90])} disabled={isMoving} style={{ backgroundColor: '#374151', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}>Pos 3</button>
            <button onClick={() => setTargetAngles([0, 90, 0, -90, 0, 90, 0])} disabled={isMoving} style={{ backgroundColor: '#374151', padding: '0.5rem', borderRadius: '0.25rem', border: 'none', color: 'white', fontSize: '0.875rem', cursor: 'pointer' }}>Home Up</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;