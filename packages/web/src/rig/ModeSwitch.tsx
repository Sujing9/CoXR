import { useXR } from '@react-three/xr';
import { PCRig } from './PCRig';
import { XRRig } from './XRRig';

/**
 * 根据当前是否处于 XR session，切换 PC / XR 两套 Rig。
 * 必须挂在 <XR> 内部的 R3F 子树里。
 */
export function ModeSwitch() {
  const inXR = useXR((s) => s.session != null);
  return inXR ? <XRRig /> : <PCRig />;
}
