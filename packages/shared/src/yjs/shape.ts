/**
 * Yjs 协同文档结构常量。
 * 所有客户端必须使用相同的 top-level key，确保合并时指向同一 CRDT 容器。
 */

export const DOC_KEYS = {
  meta: 'meta',
  recordTypes: 'recordTypes',
  records: 'records',
  relations: 'relations',
  views: 'views',
  scene: 'scene',
  annotations: 'annotations',
} as const;

export const META_KEYS = {
  docVersion: 'docVersion',
  title: 'title',
} as const;

export const SCENE_KEYS = {
  items: 'items',
} as const;

export const RECORD_KEYS = {
  id: 'id',
  typeId: 'typeId',
  data: 'data',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  createdBy: 'createdBy',
} as const;

export const ANNOTATION_KEYS = {
  id: 'id',
  authorId: 'authorId',
  createdAt: 'createdAt',
  body: 'body',
  anchor: 'anchor',
  threadId: 'threadId',
  resolved: 'resolved',
} as const;
