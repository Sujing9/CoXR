import { request, setToken } from './client.js';
import type { UserId } from '@coxr/shared';

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: UserId;
  username: string;
  nickname: string;
  permissions: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterParams {
  username: string;
  /** 显示昵称 */
  nickname: string;
  /** 长度 8–128 */
  password: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * POST /api/auth/register
   *
   * 注册新用户。成功后自动将 token 写入 localStorage。
   * 第一个注册的用户将获得完整权限（FIRST_USER_PERMISSIONS）。
   */
  async register(params: RegisterParams): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: params,
      auth: false,
    });
    setToken(res.token);
    return res;
  },

  /**
   * POST /api/auth/login
   *
   * 用户名密码登录。成功后自动将 token 写入 localStorage。
   */
  async login(params: LoginParams): Promise<AuthResponse> {
    const res = await request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: params,
      auth: false,
    });
    setToken(res.token);
    return res;
  },
};
