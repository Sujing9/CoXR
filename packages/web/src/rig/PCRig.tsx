import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { WORLD } from '../constants/world';

/**
 * PC 模式 Rig：类 3D 建模软件的中心旋转视角。
 * - 左键旋转、中键平移、滚轮缩放
 * - target 固定在地板上方 EYE_HEIGHT 附近，避免镜头钻入地下
 */
export function PCRig() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[4, 2.8, 4]} fov={55} near={0.05} far={200} />
      <OrbitControls
        makeDefault
        target={[0, WORLD.EYE_HEIGHT * 0.6, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={0.8}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.01}
      />
    </>
  );
}
