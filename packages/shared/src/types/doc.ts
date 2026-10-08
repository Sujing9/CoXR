import type { Annotation } from './annotation.js';
import type { RecordDoc, RecordTypeDef } from './record.js';
import type { Relation } from './relation.js';
import type { Scene } from './scene.js';
import type { ViewConfig } from './view.js';

export interface DocMeta {
  docVersion: number;
  title?: string;
}

/**
 * 协同文档的纯序列化视角（快照 / 服务端只读 / 网络消息）。
 * 与 Yjs 同步态的差异：
 *   - records[*].data 中 longText 值从 Y.Text 变为 string
 *   - annotations[*].body 从 Y.Text 变为 string
 *   - 所有 Y.Map / Y.Array 容器被折叠为 object / array
 */
export interface SerializedDoc {
  meta: DocMeta;
  recordTypes: { [id: string]: RecordTypeDef };
  records: { [id: string]: RecordDoc };
  relations: { [id: string]: Relation };
  views: { [id: string]: ViewConfig };
  scene: Scene;
  annotations: { [id: string]: Annotation };
}
