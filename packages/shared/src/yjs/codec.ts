import * as Y from 'yjs';
import { DOC_VERSION } from '../constants/index.js';
import type { Annotation } from '../types/annotation.js';
import type { DocMeta, SerializedDoc } from '../types/doc.js';
import type { AnnotationId, RecordId } from '../types/ids.js';
import type { RecordDoc, RecordTypeDef } from '../types/record.js';
import type { Relation } from '../types/relation.js';
import type { SceneItem } from '../types/scene.js';
import type { ViewConfig } from '../types/view.js';
import { createAnnotation, readAnnotation } from './annotation.js';
import {
  getAnnotationsMap,
  getMetaMap,
  getRecordTypesMap,
  getRecordsMap,
  getRelationsMap,
  getSceneItemsMap,
  getViewsMap,
  initYDoc,
} from './doc.js';
import { createRecord, readRecord } from './record.js';
import { META_KEYS } from './shape.js';

/**
 * 将 YDoc 折叠成纯 JSON 快照（`SerializedDoc`）。
 * 用于服务端只读处理、调试、与 `space_snapshots.yjs_document` 并行保留的 JSON 备份。
 * 不用于持久化协同状态 —— 持久化请使用 `encodeSnapshotBinary`。
 */
export function toSerializedDoc(doc: Y.Doc): SerializedDoc {
  const metaMap = getMetaMap(doc);
  const title = metaMap.get(META_KEYS.title) as string | undefined;
  const meta: DocMeta = {
    docVersion:
      (metaMap.get(META_KEYS.docVersion) as number | undefined) ?? DOC_VERSION,
    ...(title !== undefined ? { title } : {}),
  };

  const recordTypes: SerializedDoc['recordTypes'] = {};
  for (const [k, v] of getRecordTypesMap(doc).entries()) {
    recordTypes[k] = v as RecordTypeDef;
  }

  const records: SerializedDoc['records'] = {};
  for (const k of getRecordsMap(doc).keys()) {
    const r = readRecord(doc, k as RecordId);
    if (r) records[k] = r;
  }

  const relations: SerializedDoc['relations'] = {};
  for (const [k, v] of getRelationsMap(doc).entries()) {
    relations[k] = v as Relation;
  }

  const views: SerializedDoc['views'] = {};
  for (const [k, v] of getViewsMap(doc).entries()) {
    views[k] = v as ViewConfig;
  }

  const items: SerializedDoc['scene']['items'] = {};
  for (const [k, v] of getSceneItemsMap(doc).entries()) {
    items[k] = v as SceneItem;
  }

  const annotations: SerializedDoc['annotations'] = {};
  for (const k of getAnnotationsMap(doc).keys()) {
    const a = readAnnotation(doc, k as AnnotationId);
    if (a) annotations[k] = a;
  }

  return { meta, recordTypes, records, relations, views, scene: { items }, annotations };
}

/** 二进制快照（包含 CRDT 历史），用于写入 `space_snapshots.yjs_document`。 */
export function encodeSnapshotBinary(doc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(doc);
}

/** 从二进制快照恢复到现有 YDoc；同一 YDoc 可多次 apply 以合并多份 update。 */
export function applySnapshotBinary(doc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(doc, update);
}

/**
 * 将 liveDoc 的内容硬覆盖为 snapshotUpdate 所表示的状态。
 * 策略：清空所有顶层 map → 从快照序列化的纯 JSON 重建简单字段 → 用 createRecord / createAnnotation 重建嵌套结构。
 * 修改会通过 Hocuspocus provider 广播给所有在线协作者。
 */
export function restoreDocFromSnapshot(liveDoc: Y.Doc, snapshotUpdate: Uint8Array): void {
  // 1. 加载快照到临时 doc
  // 注意：必须先 applyUpdate 再 initYDoc，否则 initYDoc 会在全新 doc 上
  // 创建新的 CRDT Item（如 scene.items），与快照中同 clock 的 Item 产生冲突，
  // 导致 Yjs 按 clientID 大小决胜，约 50% 概率空 Y.Map 胜出，场景元素丢失。
  const snapDoc = new Y.Doc();
  Y.applyUpdate(snapDoc, snapshotUpdate);
  initYDoc(snapDoc); // 对合法快照为 no-op，仅补全缺失命名空间
  const serialized = toSerializedDoc(snapDoc);

  liveDoc.transact(() => {
    // 2. 清空 records
    const recMap = getRecordsMap(liveDoc);
    for (const k of [...recMap.keys()]) recMap.delete(k);

    // 3. 清空 annotations
    const annMap = getAnnotationsMap(liveDoc);
    for (const k of [...annMap.keys()]) annMap.delete(k);

    // 4. 清空简单 JSON map
    const rtMap = getRecordTypesMap(liveDoc);
    for (const k of [...rtMap.keys()]) rtMap.delete(k);

    const relMap = getRelationsMap(liveDoc);
    for (const k of [...relMap.keys()]) relMap.delete(k);

    const viewsMap = getViewsMap(liveDoc);
    for (const k of [...viewsMap.keys()]) viewsMap.delete(k);

    const itemsMap = getSceneItemsMap(liveDoc);
    for (const k of [...itemsMap.keys()]) itemsMap.delete(k);

    // 5. 更新 meta
    const meta = getMetaMap(liveDoc);
    meta.set(META_KEYS.docVersion, serialized.meta.docVersion);
    if (serialized.meta.title !== undefined) meta.set(META_KEYS.title, serialized.meta.title);
    else if (meta.has(META_KEYS.title)) meta.delete(META_KEYS.title);

    // 6. 重建简单 JSON maps
    for (const [k, v] of Object.entries(serialized.recordTypes)) rtMap.set(k, v);
    for (const [k, v] of Object.entries(serialized.relations)) relMap.set(k, v);
    for (const [k, v] of Object.entries(serialized.views)) viewsMap.set(k, v);
    for (const [k, v] of Object.entries(serialized.scene.items)) itemsMap.set(k, v);
  });

  // 7. 重建 records（包含嵌套 Y.Map/Y.Text，需在事务外创建）
  for (const [id, record] of Object.entries(serialized.records)) {
    createRecord(liveDoc, {
      id: id as RecordId,
      typeId: record.typeId,
      data: record.data,
      createdBy: record.createdBy,
      now: record.createdAt,
    });
  }

  // 8. 重建 annotations
  for (const [id, ann] of Object.entries(serialized.annotations)) {
    createAnnotation(liveDoc, {
      id: id as AnnotationId,
      authorId: ann.authorId,
      body: ann.body,
      anchor: ann.anchor,
      ...(ann.threadId !== undefined ? { threadId: ann.threadId } : {}),
      now: ann.createdAt,
    });
  }
}
