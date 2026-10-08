import type * as Y from 'yjs';
import type { FieldId, FieldValue, RecordId } from '@coxr/shared';
import { updateRecordField } from '@coxr/shared/yjs';

/**
 * 协同写入动作：显式接收当前 live Y.Doc，避免 UI 绕过活动空间。
 */

export function setRecordField(
  doc: Y.Doc,
  recordId: RecordId,
  fieldId: FieldId,
  value: FieldValue,
): void {
  updateRecordField(doc, recordId, fieldId, value);
}

export function toggleRecordBoolean(
  doc: Y.Doc,
  recordId: RecordId,
  fieldId: FieldId,
  current: boolean | null,
): void {
  setRecordField(doc, recordId, fieldId, !current);
}
