import type { FieldId, RecordId, RecordTypeId, UserId } from './ids.js';
import type { FieldDef, FieldValue } from './field.js';

/**
 * 记录类型：字段内嵌（MVP 方案 A，非字段池）。
 */
export interface RecordTypeDef {
  id: RecordTypeId;
  name: string;
  primaryFieldId: FieldId;
  /** 字段按 id 索引。 */
  fields: { [fieldId: string]: FieldDef };
  /** 字段显示顺序。 */
  fieldOrder: FieldId[];
}

export type RecordData = { [fieldId: string]: FieldValue };

/**
 * 记录（序列化视角）。名字加 Doc 后缀避免与 TS 内建 `Record` 冲突。
 * 在 Yjs 同步态中：
 *   - 外层为 Y.Map
 *   - data 为 Y.Map；longText 字段的值为 Y.Text
 *   - updatedAt 存在字段内，由写入方维护
 */
export interface RecordDoc {
  id: RecordId;
  typeId: RecordTypeId;
  data: RecordData;
  createdAt: number;
  updatedAt: number;
  createdBy: UserId;
}
