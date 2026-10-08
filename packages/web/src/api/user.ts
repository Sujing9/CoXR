import { request } from './client.js';
import type { AuthUser } from './auth.js';

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface MeResponse {
  user: AuthUser & { createdAt: string };
}

export interface PatchMeParams {
  nickname: string;
}

export interface ChangePasswordParams {
  oldPassword: string;
  newPassword: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const userApi = {
  /**
   * GET /api/user/me
   *
   * 获取当前登录用户的完整信息。需要有效的 JWT token。
   */
  async getMe(): Promise<MeResponse> {
    return request<MeResponse>('/api/user/me', { method: 'GET' });
  },

  /**
   * PATCH /api/user/me
   *
   * 更新当前用户的昵称。需要有效的 JWT token。
   */
  async patchMe(params: PatchMeParams): Promise<MeResponse> {
    return request<MeResponse>('/api/user/me', {
      method: 'PATCH',
      body: params,
    });
  },

  /**
   * PATCH /api/user/me/password
   *
   * 修改当前用户密码。需要有效的 JWT token。
   */
  async changePassword(params: ChangePasswordParams): Promise<{ message: string }> {
    return request<{ message: string }>('/api/user/me/password', {
      method: 'PATCH',
      body: params,
    });
  },
};
