import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useXRPanelStore } from '../xrPanelStore';
import { useXRPanelUIStore } from '../xrPanelUIStore';

const _camPos = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookMatrix = new THREE.Matrix4();
const _targetQuat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * 让一个 group：
 *   位置 = 相机世界位置 + worldOffset（世界向量，转头不变）
 *   朝向 = lookAt(camera)（永远朝向用户）+ slerp 阻尼
 *   scale = store.scale
 */
export function usePanelTransform(opts?: { rotationSlerp?: number }) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const rotationSlerp = opts?.rotationSlerp ?? 0.18;
  const snappedRef = useRef(false);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    if (!useXRPanelUIStore.getState().initialized) {
      snappedRef.current = false;
      return;
    }

    const { worldOffset, scale } = useXRPanelStore.getState();
    camera.getWorldPosition(_camPos);

    _targetPos.set(
      _camPos.x + worldOffset.x,
      _camPos.y + worldOffset.y,
      _camPos.z + worldOffset.z,
    );
    group.position.copy(_targetPos);

    // Matrix4.lookAt(eye, target, up) 会让 -Z 从 eye 指向 target。
    // 我们希望面板的 +Z 朝向相机（uikit Container 内容画在 +Z 面），
    // 所以 eye=camera, target=panel —— -Z 由相机指向面板，
    // 等价于面板的 +Z 指向相机。
    _lookMatrix.lookAt(_camPos, _targetPos, _up);
    _targetQuat.setFromRotationMatrix(_lookMatrix);
    if (!snappedRef.current) {
      group.quaternion.copy(_targetQuat);
      snappedRef.current = true;
    } else {
      group.quaternion.slerp(_targetQuat, rotationSlerp);
    }

    group.scale.setScalar(scale);
  });

  return ref;
}
