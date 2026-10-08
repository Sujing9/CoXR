import { DOC_VERSION } from '../constants/index.js';
import type { SerializedDoc } from '../types/doc.js';
export * from './starter.js';

/**
 * 平台通用 Web Crypto 声明：浏览器与 Node 20+ 均提供全局 `crypto.randomUUID`。
 * 在 shared 包内避免依赖 `@types/node` 或 `DOM` lib，使用最小化 ambient 声明。
 */
declare const crypto: { randomUUID(): string };

/** UUID v4。 */
export function uuid(): string {
  return crypto.randomUUID();
}

/** 生成一个空的协同文档序列化态快照。 */
export function createEmptyDoc(): SerializedDoc {
  return {
    meta: { docVersion: DOC_VERSION },
    recordTypes: {},
    records: {},
    relations: {},
    views: {},
    scene: { items: {} },
    annotations: {},
  };
}
