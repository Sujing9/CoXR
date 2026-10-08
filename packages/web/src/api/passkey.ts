import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import { request, setToken } from './client.js';
import type { AuthResponse } from './auth.js';

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export interface PasskeyCredential {
  id: string;
  deviceName: string;
  aaguid: string;
  transports: string[] | null;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const passkeyApi = {
  /**
   * 完整注册通行证流程（两阶段）。
   * 需要用户已登录（JWT）。
   *
   * 1. POST /api/auth/webauthn/register/begin  → 获取 options
   * 2. 浏览器调用 navigator.credentials.create
   * 3. POST /api/auth/webauthn/register/complete → 保存凭证
   */
  async register(deviceName = '我的通行证'): Promise<PasskeyCredential> {
    // Step 1: 获取注册 options
    const options = await request<Record<string, unknown>>(
      '/api/auth/webauthn/register/begin',
      { method: 'POST', body: {} },
    );

    // Step 2: 触发浏览器通行证注册
    const regResponse = await startRegistration({ optionsJSON: options as never });

    // Step 3: 将注册结果发送到服务端完成验证
    const result = await request<{ credential: PasskeyCredential }>(
      '/api/auth/webauthn/register/complete',
      { method: 'POST', body: { response: regResponse, deviceName } },
    );

    return result.credential;
  },

  /**
   * 完整通行证登录流程（两阶段）。
   * 无需提前输入账户名，浏览器自动弹出设备上已存储的通行证。
   *
   * 1. POST /api/auth/webauthn/login/begin → 获取 options + sessionId
   * 2. 浏览器调用 navigator.credentials.get（用户选择通行证）
   * 3. POST /api/auth/webauthn/login/complete → 服务端用 userHandle 识别用户，返回 JWT
   */
  async login(): Promise<AuthResponse> {
    // Step 1: 获取认证 options 及 sessionId
    const { sessionId, ...options } = await request<
      Record<string, unknown> & { sessionId: string }
    >('/api/auth/webauthn/login/begin', { method: 'POST', body: {}, auth: false });

    // Step 2: 触发浏览器通行证选择器
    const authResponse = await startAuthentication({ optionsJSON: options as never });

    // Step 3: 将认证结果及 sessionId 发送服务端
    const res = await request<AuthResponse>('/api/auth/webauthn/login/complete', {
      method: 'POST',
      body: { sessionId, response: authResponse },
      auth: false,
    });

    setToken(res.token);
    return res;
  },

  /**
   * 获取当前用户的所有通行证列表。
   * GET /api/auth/webauthn/credentials
   */
  async list(): Promise<PasskeyCredential[]> {
    const res = await request<{ credentials: PasskeyCredential[] }>(
      '/api/auth/webauthn/credentials',
    );
    return res.credentials;
  },

  /**
   * 删除指定通行证。
   * DELETE /api/auth/webauthn/credentials/:id
   */
  async delete(id: string): Promise<void> {
    await request<void>(`/api/auth/webauthn/credentials/${id}`, {
      method: 'DELETE',
    });
  },
};
