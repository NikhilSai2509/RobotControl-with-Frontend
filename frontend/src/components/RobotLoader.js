import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import URDFLoader from "urdf-loader";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const RobotLoader = ({ jointAngles }) => {
  const url = "/urdf/kuka_iiwa/model.urdf";
  const { scene } = useThree();
  const robotRef = useRef();

  useEffect(() => {
    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);

    // Configure mesh loader for different file types
    loader.loadMeshCb = (path, manager, onComplete) => {
      console.log('🔄 Loading mesh:', path);
      const extension = path.split('.').pop().toLowerCase();
      
      if (extension === 'stl') {
        const stlLoader = new STLLoader(manager);
        stlLoader.load(
          path,
          (geometry) => {
            console.log('✅ STL loaded:', path);
            geometry.computeVertexNormals();
            
            const material = new THREE.MeshStandardMaterial({
              color: 0xff6b00, // KUKA orange
              metalness: 0.6,
              roughness: 0.4
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            onComplete(mesh);
          },
          undefined,
          (error) => {
            console.error('❌ STL load error:', path, error);
            onComplete(null);
          }
        );
      } else if (extension === 'obj') {
        const objLoader = new OBJLoader(manager);
        objLoader.load(
          path,
          (obj) => {
            console.log('✅ OBJ loaded:', path);
            
            // Apply material to all meshes in the OBJ
            obj.traverse((child) => {
              if (child.isMesh) {
                child.material = new THREE.MeshStandardMaterial({
                  color: 0xff6b00, // KUKA orange
                  metalness: 0.6,
                  roughness: 0.4
                });
                child.castShadow = true;
                child.receiveShadow = true;
              }
            });
            
            onComplete(obj);
          },
          undefined,
          (error) => {
            console.error('❌ OBJ load error:', path, error);
            // Create placeholder
            const geometry = new THREE.BoxGeometry(0.05, 0.05, 0.05);
            const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            onComplete(new THREE.Mesh(geometry, material));
          }
        );
      } else if (extension === 'dae') {
        console.warn('⚠️ DAE not supported, using placeholder for:', path);
        const geometry = new THREE.SphereGeometry(0.03, 16, 16);
        const material = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        onComplete(new THREE.Mesh(geometry, material));
      } else {
        console.warn('⚠️ Unsupported format:', extension);
        const geometry = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        onComplete(new THREE.Mesh(geometry, material));
      }
    };

    console.log('🔄 Loading KUKA URDF:', url);

    loader.load(
      url,
      (robot) => {
        console.log('✅ URDF Robot loaded successfully!');
        console.log('Robot object:', robot);
        console.log('Robot joints:', Object.keys(robot.joints || {}));
        
        robotRef.current = robot;

        // Position robot
        robot.position.set(0, 0, 0);
        robot.rotation.set(0, 0, 0);
        
        // Calculate bounding box
        const bbox = new THREE.Box3().setFromObject(robot);
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        console.log('📦 Robot bounding box:');
        console.log('  Size:', size);
        console.log('  Center:', center);
        console.log('  Min:', bbox.min);
        console.log('  Max:', bbox.max);
        
        // Count meshes
        let meshCount = 0;
        robot.traverse((child) => {
          if (child.isMesh) {
            meshCount++;
            console.log(`  Mesh ${meshCount}:`, {
              name: child.name,
              visible: child.visible,
              vertices: child.geometry?.attributes?.position?.count || 0
            });
          }
        });
        
        console.log(`✅ Total meshes loaded: ${meshCount}`);
        
        if (meshCount === 0) {
          console.error('⚠️ WARNING: No meshes found! Robot will be invisible!');
        }
        
        // Add to scene
        scene.add(robot);
        console.log('✅ Robot added to scene at position:', robot.position);
      },
      undefined,
      (error) => {
        console.error('❌ URDF load error:', error);
      }
    );

    return () => {
      if (robotRef.current) {
        scene.remove(robotRef.current);
      }
    };
  }, [url, scene]);

  // Update joint angles every frame
  useFrame(() => {
    if (robotRef.current && robotRef.current.joints) {
      const jointNames = [
        'lbr_iiwa_joint_1',
        'lbr_iiwa_joint_2',
        'lbr_iiwa_joint_3',
        'lbr_iiwa_joint_4',
        'lbr_iiwa_joint_5',
        'lbr_iiwa_joint_6',
        'lbr_iiwa_joint_7'
      ];

      jointNames.forEach((name, index) => {
        const joint = robotRef.current.joints[name];
        if (joint && joint.setJointValue && jointAngles[index] !== undefined) {
          const angleRad = (jointAngles[index] * Math.PI) / 180;
          joint.setJointValue(angleRad);
        }
      });
    }
  });

  return null;
};

export default RobotLoader;