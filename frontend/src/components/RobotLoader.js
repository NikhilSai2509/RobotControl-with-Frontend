import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import URDFLoader from "urdf-loader";
// import { STLLoader } from "three/examples/jsm/loaders/STLLoader"; we only have obj files for our robot
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

const RobotLoader = ({ jointAngles }) => {
  const url = "/urdf/franka_panda/panda.urdf";
  const { scene } = useThree();
  const robotRef = useRef();

  useEffect(() => {
    const manager = new THREE.LoadingManager();
    const loader = new URDFLoader(manager);

    // CRITICAL: Configure package path resolution
    loader.packages = {
      'franka_panda': '/urdf/franka_panda'
    };

    let loadedMeshes = 0;
    let failedMeshes = 0;


    loader.loadMeshCb = (path, manager, onComplete) => {
      console.log('📄 Loading mesh:', path);
      const extension = path.split('.').pop().toLowerCase();
      
      if (extension === 'obj') {
        const objLoader = new OBJLoader(manager);
        objLoader.load(
          path,
          (obj) => {
            loadedMeshes++;
            console.log('✅ OBJ loaded:', path);
            console.log('Loaded meshes :', loadedMeshes);
            
            // Validate and apply materials
            let hasValidGeometry = false;
            obj.traverse((child) => {
              if (child.isMesh) {
                // Check if geometry is valid
                if (child.geometry && child.geometry.attributes.position) {
                  hasValidGeometry = true;
                  
                  // Compute normals if missing
                  if (!child.geometry.attributes.normal) {
                    child.geometry.computeVertexNormals();
                  }
                  
                  // Apply material with enhanced settings for better visibility
                  child.material = new THREE.MeshStandardMaterial({
                    color: 0xeeeeee,        // Light gray/white
                    metalness: 0.3,
                    roughness: 0.6,
                    side: THREE.DoubleSide, // Render both sides
                    flatShading: false
                  });
                  
                  child.castShadow = true;
                  child.receiveShadow = true;
                } else {
                  console.warn('⚠️ Mesh child has invalid geometry:', child.name);
                }
              }
            });
            
            if (!hasValidGeometry) {
              console.warn('⚠️ OBJ loaded but no valid geometry found:', path);
            }
            
            onComplete(obj);
          },
          (progress) => {
            if (progress.loaded && progress.total) {
              const percent = (progress.loaded / progress.total * 100).toFixed(0);
              console.log(`   Progress: ${percent}%`);
            }
          },
          (error) => {
            failedMeshes++;
            console.error('❌ OBJ load FAILED:', path);
            console.error('   Error:', error.message || error);
            console.error('Obj loading failed , numer of failed meashes : ',failedMeshes)
            
            // Create visible placeholder
            const geometry = new THREE.CylinderGeometry(0.03, 0.03, 0.1, 16);
            const material = new THREE.MeshStandardMaterial({ 
              color: 0xff0000,
              wireframe: true,
              transparent: true,
              opacity: 0.7
            });
            const placeholder = new THREE.Mesh(geometry, material);
            onComplete(placeholder);
          }
        );
      } 
      else {
        failedMeshes++;
        console.warn('⚠️ Unsupported format:', extension);
        const geometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
        const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
        onComplete(new THREE.Mesh(geometry, material));
      }
    };

    console.log('🔄 Loading Panda robot URDF...');

    loader.load(
      url,
      (robot) => {
        console.log('✅ URDF Robot loaded!');
        
        robotRef.current = robot;
        robot.position.set(0, 0, 0);
        robot.rotation.set(-Math.PI / 2, 0, 0);
        
        scene.add(robot);
        
        // WAIT for meshes to finish loading before checking
        setTimeout(() => {
          let meshCount = 0;
          robot.traverse((child) => {
            if (child.isMesh) meshCount++;
          });
          
          console.log(`📊 Final mesh count: ${meshCount}`);
          
          if (meshCount === 0) {
            console.error('❌ No meshes in robot after loading!');
          } else {
            console.log(`✅ Robot fully loaded with ${meshCount} meshes`);
          }
        }, 1000); // Wait 1 second for async mesh loading
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
        'panda_joint1',
        'panda_joint2',
        'panda_joint3',
        'panda_joint4',
        'panda_joint5',
        'panda_joint6',
        'panda_joint7'
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