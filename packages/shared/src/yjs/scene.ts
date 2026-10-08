import type * as Y from 'yjs';
import type { SceneItemId } from '../types/ids.js';
import type { SceneItem } from '../types/scene.js';
import { getSceneItemsMap } from './doc.js';

/**
 * SceneItem 采用整体替换式存储（Y.Map<itemId, SceneItem>）。
 * 本体非 Y.Map 的原因：MVP 阶段同一个 item 的并发编辑需求低，整体替换足够；
 * 需细粒度协同时再把 overrides 等字段单独拆成 Y.Map。
 */

export function upsertSceneItem(doc: Y.Doc, item: SceneItem): void {
  getSceneItemsMap(doc).set(item.id, item);
}

export function deleteSceneItem(doc: Y.Doc, id: SceneItemId): void {
  getSceneItemsMap(doc).delete(id);
}

export function getSceneItem(doc: Y.Doc, id: SceneItemId): SceneItem | undefined {
  return getSceneItemsMap(doc).get(id) as SceneItem | undefined;
}

export function listSceneItems(doc: Y.Doc): SceneItem[] {
  const out: SceneItem[] = [];
  for (const v of getSceneItemsMap(doc).values()) {
    out.push(v as SceneItem);
  }
  return out;
}
