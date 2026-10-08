import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { COLORS } from '../constants/world';

/**
 * 场景环境：灯光 + 背景色。
 * 不包含相机与控制器（由 Rig 负责）。
 */
export function Environment() {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(COLORS.BG);
    return () => {
      scene.background = null;
    };
  }, [scene]);

  return (
    <>

      {/* 环境光：填充阴影区域 */}
      <ambientLight intensity={0.55} />

      {/* 半球光：天地色差，模拟柔和环境光 */}
      <hemisphereLight args={[COLORS.SKY, COLORS.GROUND, 0.7]} />

      {/* 主方向光：产生柔和阴影 */}
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
        shadow-camera-near={0.1}
        shadow-camera-far={40}
        shadow-bias={-0.0005}
      />

      {/* 辅助补光：来自相反方向的低强度冷光，现代感 */}
      <directionalLight position={[-5, 4, -3]} intensity={0.25} color="#8ab4ff" />
    </>
  );
}
