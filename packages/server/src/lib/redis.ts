import { Redis } from 'ioredis';
import { env } from '../env.js';

// 共享 Redis 单例，供 WebAuthn challenge 等短生命周期 key 使用
export const redis = new Redis(env.REDIS_URL, { lazyConnect: true });

// Challenge TTL（秒）
export const CHALLENGE_TTL = 300;

// ─── 协作文档持久化 ────────────────────────────────────────────────────────────

/** Redis key：存储某空间的 Yjs 文档最近一次持久化状态 */
export function docStateKey(spaceId: string): string {
  return `coxr:doc:space:${spaceId}`;
}

/** 文档状态在 Redis 中的 TTL（秒）：90 天 */
export const DOC_STATE_TTL = 60 * 60 * 24 * 90;
