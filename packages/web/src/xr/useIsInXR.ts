import { useSyncExternalStore } from 'react';
import { xrStore } from './xrStore';

/**
 * 在 R3F Canvas 外部订阅 XR session 状态。
 * 返回 true 表示当前处于 XR session（VR/AR）中。
 * 可在任意 React 组件中调用，无需 R3F context。
 */
export function useIsInXR(): boolean {
  return useSyncExternalStore(
    (callback) => xrStore.subscribe(callback),
    () => xrStore.getState().session != null,
    () => false,
  );
}
