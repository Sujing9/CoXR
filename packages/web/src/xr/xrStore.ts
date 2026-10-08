import { createXRStore, type XRStore } from '@react-three/xr';

/**
 * 全局 XR store 单例。
 * 后续 EnterXR 按钮通过 `xrStore.enterVR()` / `enterAR()` 启动 session。
 */
export const xrStore: XRStore = createXRStore();
