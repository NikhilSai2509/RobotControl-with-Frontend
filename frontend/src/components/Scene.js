import { OrbitControls, Html, useProgress } from "@react-three/drei";
import { Suspense } from "react";
import RobotLoader from "./RobotLoader";

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: '24px' }}>
        {progress.toFixed(0)}% loaded
      </div>
    </Html>
  );
}

export default function Scene({ jointAngles, boxes = [] }) {
  return (
    <>
      <OrbitControls 
        enableDamping
        dampingFactor={0.05}
        minDistance={1}
        maxDistance={10}
      />
      
      <gridHelper args={[10, 20, 0x444444, 0x222222]} />
      <axesHelper args={[2]} />
      
      <ambientLight intensity={0.6} />
      <directionalLight
        castShadow
        intensity={1.2}
        position={[5, 10, 5]}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight intensity={0.4} position={[-5, 5, -5]} />
      <pointLight position={[0, 5, 0]} intensity={0.5} />
      
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <circleGeometry args={[5, 64]} />
        <meshStandardMaterial color="#1f2937" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Boxes */}
      {boxes.map((box) => (
        <mesh key={box.id} position={box.position} castShadow receiveShadow>
          <boxGeometry args={box.size} />
          <meshStandardMaterial 
            color={[box.color[0], box.color[1], box.color[2]]}
            metalness={0.5}
            roughness={0.5}
          />
        </mesh>
      ))}
      
      <Suspense fallback={<Loader />}>
        <RobotLoader jointAngles={jointAngles} />
      </Suspense>
    </>
  );
}