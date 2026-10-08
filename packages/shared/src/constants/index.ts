/**
 * 协同文档层 (L2) 使用的枚举常量。
 * 全部使用字符串字面量，跨 PC / XR / 服务端共享，不做数字码转换。
 */

export const FIELD_TYPES = [
  'text',
  'longText',
  'number',
  'boolean',
  'select',
  'multiSelect',
  'date',
  'url',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const VIEW_KINDS = ['table', 'gallery'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

export const SCENE_ITEM_KINDS = ['bar3d', 'scatter3d', 'line3d', 'label'] as const;
export type SceneItemKind = (typeof SCENE_ITEM_KINDS)[number];

export const RELATION_KINDS = ['ref'] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const ANNOTATION_ANCHOR_KINDS = ['record', 'field'] as const;
export type AnnotationAnchorKind = (typeof ANNOTATION_ANCHOR_KINDS)[number];

export const AGGREGATION_OPS = ['count', 'sum', 'avg', 'min', 'max'] as const;
export type AggregationOp = (typeof AGGREGATION_OPS)[number];

export const FILTER_OPS = [
  'eq',
  'neq',
  'contains',
  'gt',
  'lt',
  'gte',
  'lte',
  'isEmpty',
  'isNotEmpty',
] as const;
export type FilterOp = (typeof FILTER_OPS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/** 协同文档 schema 版本号。结构变更时递增。 */
export const DOC_VERSION = 1 as const;
