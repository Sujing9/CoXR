import type { AnnotationId, FieldId, RecordId, UserId } from './ids.js';

/**
 * 标注的语义锚点。MVP 仅支持 record / field 两种。
 * （scene-point / scene-object 延后）
 */
export type AnnotationAnchor =
  | { kind: 'record'; recordId: RecordId }
  | { kind: 'field'; recordId: RecordId; fieldId: FieldId };

/**
 * 标注（序列化视角）。
 * 同步态：外层 Y.Map；body 为 Y.Text（支持字符级协同）。
 */
export interface Annotation {
  id: AnnotationId;
  authorId: UserId;
  createdAt: number;
  body: string;
  anchor: AnnotationAnchor;
  threadId?: AnnotationId;
  resolved?: boolean;
}
