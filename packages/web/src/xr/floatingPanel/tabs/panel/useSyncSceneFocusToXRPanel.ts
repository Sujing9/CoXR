import { useEffect, useRef } from 'react';
import { useSpaceUIStore } from '@/data/spaceUIStore';
import { useXRSystemPanelStore } from '@/xr/xrSystemPanelStore';
import { useXRPanelNavStore } from './xrPanelNavStore';

/**
 * 场景 → 面板单向联动。
 *
 * 当用户在 3D 场景中点击某个 SceneItem 时，
 *   `useSpaceUIStore.focusSceneItem(id)` 会触发 `focus` 变更。
 * 该 hook 监听 focus 切换为 `sceneItem` 的事件，并：
 *   1. 切系统面板的当前 tab 到 `panel`
 *   2. 跳到 L2-A `sceneItem` 详情页
 *
 * **单向**：面板内部点击卡片只会改 `xrPanelNavStore.route`，
 *   不写 `focus`，避免双向循环。因此这里直接消费 store 即可，无需 ref guard。
 *   但仍需识别"同一 id 重复触发"以避免 push 历史溢出。
 */
export function useSyncSceneFocusToXRPanel() {
  const focus = useSpaceUIStore((s) => s.focus);
  const lastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focus || focus.kind !== 'sceneItem') {
      lastIdRef.current = null;
      return;
    }
    if (lastIdRef.current === focus.id) return;
    lastIdRef.current = focus.id;

    useXRSystemPanelStore.getState().setTab('panel');
    useXRPanelNavStore.getState().jump({ kind: 'sceneItem', id: focus.id });
  }, [focus]);
}
