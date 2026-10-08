import { create } from 'zustand';
import { spacesApi, type SpaceInfo } from '../api/spaces';

interface SpaceState {
  spaces: SpaceInfo[];
  pendingSpaces: SpaceInfo[];
  activeSpace: SpaceInfo | null;
  isLoading: boolean;

  fetchMySpaces: () => Promise<void>;
  setActiveSpace: (space: SpaceInfo) => void;
  clearActiveSpace: () => void;
  addSpace: (space: SpaceInfo) => void;
  addPendingSpace: (space: SpaceInfo) => void;
  removeSpace: (spaceId: string) => void;
  updateActiveSpace: (updates: Partial<SpaceInfo>) => void;
}

export const useSpaceStore = create<SpaceState>((set, get) => ({
  spaces: [],
  pendingSpaces: [],
  activeSpace: null,
  isLoading: false,

  fetchMySpaces: async () => {
    set({ isLoading: true });
    try {
      const { spaces: all } = await spacesApi.mine();
      const active = all.filter((s) => {
        const st = s.memberStatus ?? 2;
        // ACTIVE 是当前在线成员
        if (st === 2) return true;
        // APPROVED_PENDING_JOIN 且 lastJoinedAt 有値 = 曾经连接过的离线成员，属于已加入的空间
        if (st === 1 && s.lastJoinedAt != null) return true;
        return false;
      });
      const pending = all.filter((s) => {
        const st = s.memberStatus ?? 2;
        // PENDING 申请待审批
        if (st === 0) return true;
        // APPROVED_PENDING_JOIN 且 lastJoinedAt 为 null = 新批准但还未进入过
        if (st === 1 && s.lastJoinedAt == null) return true;
        return false;
      });
      set({ spaces: active, pendingSpaces: pending, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setActiveSpace: (space) => set({ activeSpace: space }),

  clearActiveSpace: () => set({ activeSpace: null }),

  addSpace: (space) =>
    set((state) => ({
      spaces: [space, ...state.spaces.filter((s) => s.id !== space.id)],
      pendingSpaces: state.pendingSpaces.filter((s) => s.id !== space.id),
    })),

  addPendingSpace: (space) =>
    set((state) => ({
      pendingSpaces: [space, ...state.pendingSpaces.filter((s) => s.id !== space.id)],
    })),

  removeSpace: (spaceId) =>
    set((state) => ({
      spaces: state.spaces.filter((s) => s.id !== spaceId),
      pendingSpaces: state.pendingSpaces.filter((s) => s.id !== spaceId),
      activeSpace: state.activeSpace?.id === spaceId ? null : state.activeSpace,
    })),

  updateActiveSpace: (updates) =>
    set((state) => ({
      activeSpace: state.activeSpace ? { ...state.activeSpace, ...updates } : null,
    })),
}));
