import { z } from 'zod';
import {
  AGGREGATION_OPS,
  ANNOTATION_ANCHOR_KINDS,
  FIELD_TYPES,
  FILTER_OPS,
  RELATION_KINDS,
  SCENE_ITEM_KINDS,
  SORT_DIRECTIONS,
  VIEW_KINDS,
} from '../constants/index.js';

/**
 * 序列化态 (JSON) 的 Zod 校验。
 * 用途：协同文档快照、服务端消息、持久化边界校验；
 * 不用于 Yjs 同步态结构（Y.Map/Y.Text 不是 JSON，无需校验）。
 *
 * 设计取舍：只对"进出系统边界"的数据做结构校验，不做运行态热路径校验。
 */

// ---- 基础 ----

const UuidSchema = z.string().uuid();
const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
const Transform3DSchema = z.object({
  position: Vec3Schema,
  rotation: Vec3Schema,
  scale: Vec3Schema,
});

// ---- field ----

const SelectOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

const FieldDefSchema = z.discriminatedUnion('type', [
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('text') }),
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('longText') }),
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('number') }),
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('boolean') }),
  z.object({
    id: UuidSchema,
    name: z.string(),
    type: z.literal('select'),
    options: z.array(SelectOptionSchema),
  }),
  z.object({
    id: UuidSchema,
    name: z.string(),
    type: z.literal('multiSelect'),
    options: z.array(SelectOptionSchema),
  }),
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('date') }),
  z.object({ id: UuidSchema, name: z.string(), type: z.literal('url') }),
]);

const FieldValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

// ---- record ----

const RecordTypeDefSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  primaryFieldId: UuidSchema,
  fields: z.record(FieldDefSchema),
  fieldOrder: z.array(UuidSchema),
});

const RecordDocSchema = z.object({
  id: UuidSchema,
  typeId: UuidSchema,
  data: z.record(FieldValueSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
  createdBy: UuidSchema,
});

// ---- relation ----

const RelationSchema = z.object({
  id: UuidSchema,
  kind: z.enum(RELATION_KINDS),
  fromRecordId: UuidSchema,
  toRecordId: UuidSchema,
});

// ---- view ----

const FilterClauseSchema = z.object({
  fieldId: UuidSchema,
  op: z.enum(FILTER_OPS),
  value: FieldValueSchema.optional(),
});
const SortClauseSchema = z.object({
  fieldId: UuidSchema,
  direction: z.enum(SORT_DIRECTIONS),
});
const GroupClauseSchema = z.object({ fieldId: UuidSchema });

const ViewConfigSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  kind: z.enum(VIEW_KINDS),
  recordTypeId: UuidSchema,
  filter: z.array(FilterClauseSchema),
  sort: z.array(SortClauseSchema),
  group: GroupClauseSchema.nullable(),
  fieldVisibility: z.record(z.boolean()),
  fieldOrder: z.array(UuidSchema),
});

// ---- scene ----

const Bar3DItemSchema = z.object({
  id: UuidSchema,
  kind: z.literal('bar3d'),
  name: z.string().optional(),
  sourceViewId: UuidSchema,
  xField: UuidSchema.nullable(),
  yField: UuidSchema.nullable(),
  zField: UuidSchema.nullable(),
  transform3d: Transform3DSchema,
});

const Scatter3DItemSchema = z.object({
  id: UuidSchema,
  kind: z.literal('scatter3d'),
  name: z.string().optional(),
  sourceViewId: UuidSchema,
  xField: UuidSchema.nullable(),
  yField: UuidSchema.nullable(),
  zField: UuidSchema.nullable(),
  colorField: UuidSchema.nullable(),
  sizeField: UuidSchema.nullable(),
  transform3d: Transform3DSchema,
});

const Line3DItemSchema = z.object({
  id: UuidSchema,
  kind: z.literal('line3d'),
  name: z.string().optional(),
  sourceViewId: UuidSchema,
  xField: UuidSchema.nullable(),
  yField: UuidSchema.nullable(),
  colorField: UuidSchema.nullable(),
  transform3d: Transform3DSchema,
});

const LabelItemSchema = z.object({
  id: UuidSchema,
  kind: z.literal('label'),
  annotationId: UuidSchema,
  transform3d: Transform3DSchema,
});

const SceneItemSchema = z.discriminatedUnion('kind', [
  Bar3DItemSchema,
  Scatter3DItemSchema,
  Line3DItemSchema,
  LabelItemSchema,
]);

const SceneSchema = z.object({
  items: z.record(SceneItemSchema),
});

// ---- annotation ----

const AnnotationAnchorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('record'), recordId: UuidSchema }),
  z.object({
    kind: z.literal('field'),
    recordId: UuidSchema,
    fieldId: UuidSchema,
  }),
]);

const AnnotationSchema = z.object({
  id: UuidSchema,
  authorId: UuidSchema,
  createdAt: z.number(),
  body: z.string(),
  anchor: AnnotationAnchorSchema,
  threadId: UuidSchema.optional(),
  resolved: z.boolean().optional(),
});

// ---- top-level doc ----

const DocMetaSchema = z.object({
  docVersion: z.number(),
  title: z.string().optional(),
});

export const SerializedDocSchema = z.object({
  meta: DocMetaSchema,
  recordTypes: z.record(RecordTypeDefSchema),
  records: z.record(RecordDocSchema),
  relations: z.record(RelationSchema),
  views: z.record(ViewConfigSchema),
  scene: SceneSchema,
  annotations: z.record(AnnotationSchema),
});

// sanity — ensure exhaustive coverage of enum constants at typecheck-time
const _sceneKindCoverage: ReadonlyArray<(typeof SCENE_ITEM_KINDS)[number]> =
  SCENE_ITEM_KINDS;
const _fieldTypeCoverage: ReadonlyArray<(typeof FIELD_TYPES)[number]> =
  FIELD_TYPES;
const _annAnchorCoverage: ReadonlyArray<(typeof ANNOTATION_ANCHOR_KINDS)[number]> =
  ANNOTATION_ANCHOR_KINDS;
void _sceneKindCoverage;
void _fieldTypeCoverage;
void _annAnchorCoverage;

export {
  AnnotationAnchorSchema,
  AnnotationSchema,
  Bar3DItemSchema,
  Scatter3DItemSchema,
  Line3DItemSchema,
  DocMetaSchema,
  FieldDefSchema,
  FieldValueSchema,
  FilterClauseSchema,
  GroupClauseSchema,
  LabelItemSchema,
  RecordDocSchema,
  RecordTypeDefSchema,
  RelationSchema,
  SceneItemSchema,
  SceneSchema,
  SelectOptionSchema,
  SortClauseSchema,
  Transform3DSchema,
  UuidSchema,
  Vec3Schema,
  ViewConfigSchema,
};
