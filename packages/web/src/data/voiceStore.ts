import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceParticipant {
  userId: string;
  nickname: string;
  /** 服务端当前活跃的 producerId；null = 未开麦 */
  producerId: string | null;
  /** 本端是否单独静音该用户（不影响其他人） */
  localMuted: boolean;
  /** 本端消费该用户音频的 consumerId */
  consumerId?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface VoiceState {
  /** 是否已建立 WebRTC 连接 */
  isConnected: boolean;
  /** 自己的麦克风是否开启（默认关闭） */
  micEnabled: boolean;
  /** 全局收听开关（false = 收听，true = 静音全部） */
  globalMuted: boolean;
  /** 当前空间内所有参与者（包括自己） */
  participants: VoiceParticipant[];

  // ── Actions ────────────────────────────────────────────────────────────────

  setConnected: (v: boolean) => void;
  setMicEnabled: (v: boolean) => void;
  setGlobalMuted: (v: boolean) => void;

  /** 用新参与者列表完全替换 */
  setParticipants: (list: VoiceParticipant[]) => void;

  /** 新增或更新某个参与者 */
  upsertParticipant: (p: Omit<VoiceParticipant, 'localMuted' | 'consumerId'>) => void;

  /** 更新参与者的 producerId */
  setParticipantProducerId: (userId: string, producerId: string | null) => void;

  /** 移除参与者 */
  removeParticipant: (userId: string) => void;

  /** 切换单个用户的本端静音 */
  toggleLocalMute: (userId: string) => void;

  /** 更新参与者的 consumerId */
  setParticipantConsumerId: (userId: string, consumerId: string) => void;

  /** 重置所有语音状态（退出空间时调用） */
  reset: () => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useVoiceStore = create<VoiceState>((set) => ({
  isConnected: false,
  micEnabled: false,
  globalMuted: false,
  participants: [],

  setConnected: (v) => set({ isConnected: v }),
  setMicEnabled: (v) => set({ micEnabled: v }),
  setGlobalMuted: (v) => set({ globalMuted: v }),

  setParticipants: (list) =>
    set({
      participants: list.map((p) => ({ ...p, localMuted: false })),
    }),

  upsertParticipant: (p) =>
    set((s) => {
      const existing = s.participants.find((x) => x.userId === p.userId);
      if (existing) {
        return {
          participants: s.participants.map((x) =>
            x.userId === p.userId ? { ...x, ...p } : x,
          ),
        };
      }
      return {
        participants: [...s.participants, { ...p, localMuted: false }],
      };
    }),

  setParticipantProducerId: (userId, producerId) =>
    set((s) => ({
      participants: s.participants.map((x) =>
        x.userId === userId ? { ...x, producerId } : x,
      ),
    })),

  removeParticipant: (userId) =>
    set((s) => ({
      participants: s.participants.filter((x) => x.userId !== userId),
    })),

  toggleLocalMute: (userId) =>
    set((s) => ({
      participants: s.participants.map((x) =>
        x.userId === userId ? { ...x, localMuted: !x.localMuted } : x,
      ),
    })),

  setParticipantConsumerId: (userId, consumerId) =>
    set((s) => ({
      participants: s.participants.map((x) =>
        x.userId === userId ? { ...x, consumerId } : x,
      ),
    })),

  reset: () =>
    set({
      isConnected: false,
      micEnabled: false,
      globalMuted: false,
      participants: [],
    }),
}));
