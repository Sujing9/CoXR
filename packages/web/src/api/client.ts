/**
 * 基础 HTTP 客户端。
 *
 * - baseURL 通过 VITE_API_BASE_URL 环境变量注入，默认回退 http://localhost:3000
 * - JWT Token 存储于 localStorage，由此处统一读写
 * - 非 2xx 响应统一抛出 ApiError
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3000';

const TOKEN_KEY = 'coxr_token';

// ─── Token 管理 ───────────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ─── ApiError ─────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── 核心 fetch 封装 ──────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** 是否自动附加 Authorization 头，默认 true */
  auth?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, headers: extraHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const json = (await response.json()) as {
        error?:
          | string
          | { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
      };
      if (typeof json.error === 'string') {
        message = json.error;
      } else if (json.error && typeof json.error === 'object') {
        const parts: string[] = [];
        if (json.error.formErrors?.length) {
          parts.push(...json.error.formErrors);
        }
        if (json.error.fieldErrors) {
          for (const [field, msgs] of Object.entries(json.error.fieldErrors)) {
            if (msgs?.length) parts.push(`${field}: ${msgs.join(', ')}`);
          }
        }
        if (parts.length) message = parts.join('\n');
      }
    } catch {
      // 无法解析 JSON body，保留 statusText
    }
    throw new ApiError(response.status, message);
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
