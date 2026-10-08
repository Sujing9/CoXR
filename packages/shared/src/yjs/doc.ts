import * as Y from 'yjs';
import { DOC_VERSION } from '../constants/index.js';
import { DOC_KEYS, META_KEYS, SCENE_KEYS } from './shape.js';

/**
 * 确保 YDoc 顶层所需的 7 个命名空间都已存在；幂等。
 * 可重复调用，不会覆盖已有内容。
 */
export function initYDoc(doc: Y.Doc): void {
  const meta = doc.getMap(DOC_KEYS.meta);
  if (!meta.has(META_KEYS.docVersion)) {
    meta.set(META_KEYS.docVersion, DOC_VERSION);
  }

  doc.getMap(DOC_KEYS.recordTypes);
  doc.getMap(DOC_KEYS.records);
  doc.getMap(DOC_KEYS.relations);
  doc.getMap(DOC_KEYS.views);
  doc.getMap(DOC_KEYS.annotations);

  const scene = doc.getMap(DOC_KEYS.scene);
  if (!(scene.get(SCENE_KEYS.items) instanceof Y.Map)) {
    scene.set(SCENE_KEYS.items, new Y.Map());
  }
}

export function getMetaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.meta);
}
export function getRecordTypesMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.recordTypes);
}
export function getRecordsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.records);
}
export function getRelationsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.relations);
}
export function getViewsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.views);
}
export function getAnnotationsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.annotations);
}
export function getSceneMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap(DOC_KEYS.scene);
}
export function getSceneItemsMap(doc: Y.Doc): Y.Map<unknown> {
  const scene = getSceneMap(doc);
  let items = scene.get(SCENE_KEYS.items);
  if (!(items instanceof Y.Map)) {
    items = new Y.Map();
    scene.set(SCENE_KEYS.items, items);
  }
  return items as Y.Map<unknown>;
}
