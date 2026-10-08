import { create } from 'zustand';

/**
 * XR 浮动面板 transform 状态。
 *
 * 位置策略：
 * - 面板世界位置 = 用户（相机）世界位置 + worldOffset（世界向量）。
 * - worldOffset 是固定在世界坐标系下的偏移量，**不是相机本地系**：
 *   用户原地转头时面板不会一起飞，控制器射线可稳定瞄准；
 *   用户走动时面板等距跟随。
 * - 拖拽小球时改写 worldOffset。
 *
 * 朝向：每帧 lookAt(camera)，让面板法线始终穿过用户摄像机（永远朝向用户）。
 */
export interface XRPanelState {
  /** 是否完全可见 */
  visible: boolean;
  /** 面板中心相对用户的世界向量偏移（米） */
  worldOffset: { x: number; y: number; z: number };
  /** 面板宽度（米） */
  width: number;
  /** 面板高度（米） */
  height: number;
  /** 整体缩放（独立于 width/height） */
  scale: number;

  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
  setWorldOffset: (offset: { x: number; y: number; z: number }) => void;
  setSize: (size: { width?: number; height?: number }) => void;
  setScale: (scale: number) => void;
}

/**
 * 默认偏移：相机正前方 0.8m，下方 0.1m。
 * 注意：进入 XR 时按用户当前朝向把这个"相机本地偏移"投影到世界向量后再写入 worldOffset。
 */
export const DEFAULT_LOCAL_OFFSET = { x: 0, y: -0.1, z: -0.85 };
export const DEFAULT_PANEL_WIDTH = 1.2;
export const DEFAULT_PANEL_HEIGHT = 0.75;

export const useXRPanelStore = create<XRPanelState>((set) => ({
  visible: true,
  worldOffset: { x: 0, y: -0.1, z: -0.85 },
  width: DEFAULT_PANEL_WIDTH,
  height: DEFAULT_PANEL_HEIGHT,
  scale: 2,

  setVisible: (v) => set({ visible: v }),
  toggleVisible: () => set((s) => ({ visible: !s.visible })),
  setWorldOffset: (offset) => set({ worldOffset: offset }),
  setSize: ({ width, height }) =>
    set((s) => ({
      width: Math.max(0.2, Math.min(2, width ?? s.width)),
      height: Math.max(0.15, Math.min(1.5, height ?? s.height)),
    })),
  setScale: (scale) => set({ scale: Math.max(0.3, Math.min(3, scale)) }),
}));
