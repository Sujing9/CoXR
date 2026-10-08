import type * as Y from 'yjs';
import { createStarterDoc } from '../factory/starter.js';
import { createAnnotation } from './annotation.js';
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
import { createRecord, upsertRecordType } from './record.js';
import { upsertSceneItem } from './scene.js';
import { META_KEYS } from './shape.js';

export function isCollaborativeDocEmpty(doc: Y.Doc): boolean {
  initYDoc(doc);
  return (
    getRecordTypesMap(doc).size === 0 &&
    getRecordsMap(doc).size === 0 &&
    getRelationsMap(doc).size === 0 &&
    getViewsMap(doc).size === 0 &&
    getSceneItemsMap(doc).size === 0 &&
    getAnnotationsMap(doc).size === 0
  );
}

export function seedStarterDoc(doc: Y.Doc): boolean {
  if (!isCollaborativeDocEmpty(doc)) return false;

  const starter = createStarterDoc();

  doc.transact(() => {
    const meta = getMetaMap(doc);
    meta.set(META_KEYS.docVersion, starter.meta.docVersion);
    if (starter.meta.title) {
      meta.set(META_KEYS.title, starter.meta.title);
    }

    for (const recordType of Object.values(starter.recordTypes)) {
      upsertRecordType(doc, recordType);
    }

    for (const record of Object.values(starter.records)) {
      createRecord(doc, {
        id: record.id,
        typeId: record.typeId,
        data: record.data,
        createdBy: record.createdBy,
        now: record.createdAt,
      });
    }

    const viewsMap = getViewsMap(doc);
    for (const view of Object.values(starter.views)) {
      viewsMap.set(view.id, view);
    }

    const relationsMap = getRelationsMap(doc);
    for (const relation of Object.values(starter.relations)) {
      relationsMap.set(relation.id, relation);
    }

    for (const item of Object.values(starter.scene.items)) {
      upsertSceneItem(doc, item);
    }

    for (const annotation of Object.values(starter.annotations)) {
      createAnnotation(doc, {
        id: annotation.id,
        authorId: annotation.authorId,
        body: annotation.body,
        anchor: annotation.anchor,
        threadId: annotation.threadId,
        now: annotation.createdAt,
      });
    }
  }, 'starter-doc');

  return true;
}