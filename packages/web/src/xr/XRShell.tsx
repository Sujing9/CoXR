import { useEffect, useRef } from 'react';
import { useXR } from '@react-three/xr';
import { useAuthStore } from '../data/authStore';
import { useSpaceStore } from '../data/spaceStore';
import { XRFloatingPanel } from './floatingPanel/XRFloatingPanel';
import { useXRPanelUIStore } from './xrPanelUIStore';

/**
 * XR 端专属 R3F 壳层，必须挂在 <XR> 内部。
 * - 仅在 XR session 激活时渲染内部 UI
 * - 后续所有 XR 专属 3D 菜单均挂载于此
 */
export function XRShell() {
  const inXR = useXR((s) => s.session != null);
  const { isLoggedIn, isLoading } = useAuthStore();
  const { activeSpace } = useSpaceStore();

  // 检测 true→false 跳变（XR session 结束），可靠地复位面板 UI 状态。
  // XRFloatingPanel 在 inXR=false 时已被 XRShell 整体 unmount，
  // 无法在自身内部监听到该跳变，因此由持久存在的 XRShell 负责。
  const prevInXRRef = useRef(false);
  useEffect(() => {
    if (prevInXRRef.current && !inXR) {
      useXRPanelUIStore.getState().resetForNextSession();
    }
    prevInXRRef.current = inXR;
  }, [inXR]);

  if (!inXR) return null;

  return (
    <>
      <XRFloatingPanel />
    </>
  );
}
