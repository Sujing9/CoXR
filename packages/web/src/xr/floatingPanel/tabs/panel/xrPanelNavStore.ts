import { create } from 'zustand';
import type { RecordTypeId, SceneItemId, ViewId } from '@coxr/shared';

/**
 * XR 面板内部导航栈。
 *
 * 与 `useSpaceUIStore.focus` 解耦：
 * - `focus` 仍代表"场景里选中的对象"（PC/XR 共用的场景级选中）。
 * - 这里的 `route` 仅决定"面板左卡当前显示哪一页"。
 *
 * L0 hub → L1 卡片墙 → L2 详情。
 */
export type PanelRoute =
  | { kind: 'hub' }
  | { kind: 'sceneItemWall' }
  | { kind: 'sceneItem'; id: SceneItemId }
  | { kind: 'viewWall' }
  | { kind: 'view'; id: ViewId }
  | { kind: 'recordTypeWall' }
  | { kind: 'recordType'; id: RecordTypeId };

interface XRPanelNavState {
  route: PanelRoute;
  history: PanelRoute[];
  push: (r: PanelRoute) => void;
  back: () => void;
  resetToHub: () => void;
  /** 直接跳到指定路由并清空历史（场景联动用）。 */
  jump: (r: PanelRoute) => void;
}

const HUB: PanelRoute = { kind: 'hub' };

export const useXRPanelNavStore = create<XRPanelNavState>((set, get) => ({
  route: HUB,
  history: [],

  push: (r) =>
    set((s) => ({
      route: r,
      history: [...s.history, s.route],
    })),

  back: () => {
    const { history } = get();
    if (history.length === 0) {
      set({ route: HUB, history: [] });
      return;
    }
    const prev = history[history.length - 1]!;
    set({ route: prev, history: history.slice(0, -1) });
  },

  resetToHub: () => set({ route: HUB, history: [] }),

  jump: (r) => set({ route: r, history: [] }),
}));
