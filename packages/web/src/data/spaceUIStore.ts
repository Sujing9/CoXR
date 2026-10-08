import { create } from 'zustand';
import type { RecordId, RecordTypeId, SceneItemId, ViewId } from '@coxr/shared';

// ── Focus target type ─────────────────────────────────────────────────────────

export type FocusTarget =
  | { kind: 'recordType'; id: RecordTypeId }
  | { kind: 'view'; id: ViewId }
  | { kind: 'record'; id: RecordId; returnViewId: ViewId }
  | { kind: 'sceneItem'; id: SceneItemId }
  | null;

// ── Store ─────────────────────────────────────────────────────────────────────

interface SpaceUIState {
  /** 当前聚焦的对象（null = 空态） */
  focus: FocusTarget;
  /** Navigator 是否展开（activeSpace 存在时默认展开） */
  navigatorOpen: boolean;
  /** 右侧详情面板是否可见 */
  detailPanelVisible: boolean;
  /**
   * 每次收到 refresh_members 事件时自增。
   * 组件可以将其作为 useEffect 依赖项来驱动列表重新加载。
   */
  memberListKey: number;
  /**
   * 每次收到 new_application / refresh_applications 事件时自增。
   */
  applicationListKey: number;

  setFocus: (target: FocusTarget) => void;
  focusRecordType: (id: RecordTypeId) => void;
  focusView: (id: ViewId) => void;
  focusRecord: (id: RecordId, returnViewId: ViewId) => void;
  focusSceneItem: (id: SceneItemId) => void;
  clearFocus: () => void;

  setNavigatorOpen: (open: boolean) => void;
  toggleNavigator: () => void;
  setDetailPanelVisible: (v: boolean) => void;
  toggleDetailPanelVisible: () => void;
  incrementMemberListKey: () => void;
  incrementApplicationListKey: () => void;
  reset: () => void;
}

export const useSpaceUIStore = create<SpaceUIState>((set) => ({
  focus: null,
  navigatorOpen: true,
  detailPanelVisible: false,
  memberListKey: 0,
  applicationListKey: 0,

  setFocus: (target) => set({ focus: target }),
  focusRecordType: (id) => set({ focus: { kind: 'recordType', id } }),
  focusView: (id) => set({ focus: { kind: 'view', id } }),
  focusRecord: (id, returnViewId) => set({ focus: { kind: 'record', id, returnViewId } }),
  focusSceneItem: (id) => set({ focus: { kind: 'sceneItem', id } }),
  clearFocus: () => set({ focus: null }),

  setNavigatorOpen: (open) => set({ navigatorOpen: open }),
  toggleNavigator: () => set((s) => ({ navigatorOpen: !s.navigatorOpen })),
  setDetailPanelVisible: (v) => set({ detailPanelVisible: v }),
  toggleDetailPanelVisible: () => set((s) => ({ detailPanelVisible: !s.detailPanelVisible })),
  incrementMemberListKey: () => set((s) => ({ memberListKey: s.memberListKey + 1 })),
  incrementApplicationListKey: () => set((s) => ({ applicationListKey: s.applicationListKey + 1 })),

  /** 退出空间时重置所有 UI 状态 */
  reset: () => set({ focus: null, navigatorOpen: true, detailPanelVisible: false, memberListKey: 0, applicationListKey: 0 }),
}));
