import * as Y from 'yjs';
import type { FieldValue } from '../types/field.js';
import type {
  FieldId,
  RecordId,
  RecordTypeId,
  UserId,
} from '../types/ids.js';
import type { RecordData, RecordDoc, RecordTypeDef } from '../types/record.js';
import { RECORD_KEYS } from './shape.js';
import { getRecordTypesMap, getRecordsMap } from './doc.js';

function isLongTextField(typeDef: RecordTypeDef | undefined, fieldId: string): boolean {
  const field = typeDef?.fields[fieldId];
  return field?.type === 'longText';
}

function valueFromCell(cell: unknown): FieldValue {
  if (cell instanceof Y.Text) return cell.toString();
  return cell as FieldValue;
}

export function createRecord(
  doc: Y.Doc,
  input: {
    id: RecordId;
    typeId: RecordTypeId;
    data: RecordData;
    createdBy: UserId;
    now?: number;
  },
): void {
  const now = input.now ?? Date.now();
  const typeDef = getRecordTypesMap(doc).get(input.typeId) as RecordTypeDef | undefined;

  const rec = new Y.Map<unknown>();
  const dataMap = new Y.Map<unknown>();
  for (const [fieldId, value] of Object.entries(input.data)) {
    if (isLongTextField(typeDef, fieldId) && typeof value === 'string') {
      const t = new Y.Text();
      t.insert(0, value);
      dataMap.set(fieldId, t);
    } else {
      dataMap.set(fieldId, value);
    }
  }

  rec.set(RECORD_KEYS.id, input.id);
  rec.set(RECORD_KEYS.typeId, input.typeId);
  rec.set(RECORD_KEYS.data, dataMap);
  rec.set(RECORD_KEYS.createdAt, now);
  rec.set(RECORD_KEYS.updatedAt, now);
  rec.set(RECORD_KEYS.createdBy, input.createdBy);

  getRecordsMap(doc).set(input.id, rec);
}

export function readRecord(doc: Y.Doc, id: RecordId): RecordDoc | undefined {
  const rec = getRecordsMap(doc).get(id);
  if (!(rec instanceof Y.Map)) return undefined;
  const dataMap = rec.get(RECORD_KEYS.data);
  const data: RecordData = {};
  if (dataMap instanceof Y.Map) {
    for (const [fieldId, value] of dataMap.entries()) {
      data[fieldId] = valueFromCell(value);
    }
  }
  return {
    id: rec.get(RECORD_KEYS.id) as RecordId,
    typeId: rec.get(RECORD_KEYS.typeId) as RecordTypeId,
    data,
    createdAt: rec.get(RECORD_KEYS.createdAt) as number,
    updatedAt: rec.get(RECORD_KEYS.updatedAt) as number,
    createdBy: rec.get(RECORD_KEYS.createdBy) as UserId,
  };
}

/**
 * 更新单个字段。longText 字段会就地修改内部 Y.Text 以保留协同历史；
 * 其它字段为替换式写入。
 */
export function updateRecordField(
  doc: Y.Doc,
  id: RecordId,
  fieldId: FieldId,
  value: FieldValue,
  now?: number,
): void {
  const rec = getRecordsMap(doc).get(id);
  if (!(rec instanceof Y.Map)) return;
  const dataMap = rec.get(RECORD_KEYS.data);
  if (!(dataMap instanceof Y.Map)) return;

  const existing = dataMap.get(fieldId);
  if (existing instanceof Y.Text && typeof value === 'string') {
    existing.delete(0, existing.length);
    existing.insert(0, value);
  } else {
    const typeId = rec.get(RECORD_KEYS.typeId) as RecordTypeId | undefined;
    const typeDef = typeId
      ? (getRecordTypesMap(doc).get(typeId) as RecordTypeDef | undefined)
      : undefined;
    if (isLongTextField(typeDef, fieldId) && typeof value === 'string') {
      const t = new Y.Text();
      t.insert(0, value);
      dataMap.set(fieldId, t);
    } else {
      dataMap.set(fieldId, value);
    }
  }
  rec.set(RECORD_KEYS.updatedAt, now ?? Date.now());
}

export function deleteRecord(doc: Y.Doc, id: RecordId): void {
  getRecordsMap(doc).delete(id);
}

export function upsertRecordType(doc: Y.Doc, def: RecordTypeDef): void {
  getRecordTypesMap(doc).set(def.id, def);
}
export function deleteRecordType(doc: Y.Doc, id: RecordTypeId): void {
  getRecordTypesMap(doc).delete(id);
}
export function readRecordType(doc: Y.Doc, id: RecordTypeId): RecordTypeDef | undefined {
  return getRecordTypesMap(doc).get(id) as RecordTypeDef | undefined;
}
