import { create } from 'zustand';
import { userApi } from '../api/user';
import type { AuthUser } from '../api/auth';
import { getToken } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  checkAuth: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggedIn: false,
  checkAuth: async () => {
    try {
      const token = getToken();
      if (!token) {
        set({ user: null, isLoggedIn: false, isLoading: false });
        return;
      }
      const { user } = await userApi.getMe();
      set({ user, isLoggedIn: true, isLoading: false });
    } catch (e) {
      // Token无效或过期
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },
  setUser: (user) => set({ user, isLoggedIn: !!user, isLoading: false }),
}));