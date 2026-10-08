import type { RecordId, RelationId } from './ids.js';
import type { RelationKind } from '../constants/index.js';

/**
 * 记录 ↔ 记录的关系（MVP 仅支持 kind='ref'）。
 * 整体替换式同步，不使用 Y.Map 作为本体。
 */
export interface Relation {
  id: RelationId;
  kind: RelationKind;
  fromRecordId: RecordId;
  toRecordId: RecordId;
}
