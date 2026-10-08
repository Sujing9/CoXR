import { useMemo } from 'react';
import * as THREE from 'three';
import { COLORS, WORLD } from '../constants/world';

interface FloorProps {
  size?: number;
  divisions?: number;
  showOrigin?: boolean;
}

/**
 * 地板系统：
 * - 一块水平平面（接收阴影）
 * - 叠加网格线（1m 一格）
 * - 原点处一个圆盘标记，作为 XR 模式下的站立参考点
 */
export function Floor({
  size = WORLD.FLOOR_SIZE,
  divisions = WORLD.FLOOR_DIVISIONS,
  showOrigin = true,
}: FloorProps) {
  const grid = useMemo(
    () => new THREE.GridHelper(size, divisions, COLORS.GRID_MAJOR, COLORS.GRID_MINOR),
    [size, divisions],
  );

  return (
    <group>
      {/* 地板平面 */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color={COLORS.FLOOR}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {/* 网格（略微抬起避免 z-fighting） */}
      <primitive object={grid} position={[0, 0.001, 0]} />

      {/* 原点标记 */}
      {showOrigin && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.002, 0]}>
          <ringGeometry args={[0.18, 0.22, 64]} />
          <meshBasicMaterial color={COLORS.ORIGIN} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
