import { create } from 'zustand';

/**
 * 系统面板的标签页（仅切换内容区域，与窗口本体的 transform/visible 解耦）。
 *
 * - 静态：space / account（始终可用）
 * - 动态：panel / members / snapshot / voice（仅在已有 activeSpace 时可用）
 */
export type XRSystemTab =
  | 'space'
  | 'account'
  | 'panel'
  | 'members'
  | 'snapshot'
  | 'voice';

interface XRSystemPanelState {
  activeTab: XRSystemTab;
  setTab: (t: XRSystemTab) => void;
}

export const useXRSystemPanelStore = create<XRSystemPanelState>((set) => ({
  activeTab: 'space',
  setTab: (t) => set({ activeTab: t }),
}));
