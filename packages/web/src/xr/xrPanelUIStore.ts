import { create } from 'zustand';

/**
 * XR 面板的 UI 模式状态（与 transform 分离）。
 * - menuOpen: 工具菜单是否展开
 * - resizing: 大小调整模式（右下手柄出现）
 * - scaling: 整体缩放模式（左下手柄出现）
 * - initialized: 是否已根据相机首次初始化过 worldOffset（XR session 维度）
 */
export interface XRPanelUIState {
  menuOpen: boolean;
  resizing: boolean;
  scaling: boolean;
  initialized: boolean;

  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  toggleResizing: () => void;
  toggleScaling: () => void;
  setInitialized: (v: boolean) => void;
  /** 退出 XR 时调用，重置所有瞬时 UI */
  resetForNextSession: () => void;
}

export const useXRPanelUIStore = create<XRPanelUIState>((set) => ({
  menuOpen: false,
  resizing: false,
  scaling: false,
  initialized: false,

  openMenu: () => set({ menuOpen: true }),
  closeMenu: () => set({ menuOpen: false }),
  toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),
  toggleResizing: () => set((s) => ({ resizing: !s.resizing })),
  toggleScaling: () => set((s) => ({ scaling: !s.scaling })),
  setInitialized: (v) => set({ initialized: v }),
  resetForNextSession: () =>
    set({ menuOpen: false, resizing: false, scaling: false, initialized: false }),
}));
