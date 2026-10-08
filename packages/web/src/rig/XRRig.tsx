import { XROrigin } from '@react-three/xr';

/**
 * XR 模式 Rig：第一人称。
 * - XROrigin 放在世界原点，头显高度由设备 reference space 提供。
 * - v1 仅站立观察；后续再接入 locomotion / 控制器交互。
 */
export function XRRig() {
  return <XROrigin position={[0, 0, 0]} />;
}
