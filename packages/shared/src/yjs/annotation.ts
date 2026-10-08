import * as Y from 'yjs';
import type { Annotation, AnnotationAnchor } from '../types/annotation.js';
import type { AnnotationId, UserId } from '../types/ids.js';
import { ANNOTATION_KEYS } from './shape.js';
import { getAnnotationsMap } from './doc.js';

export function createAnnotation(
  doc: Y.Doc,
  input: {
    id: AnnotationId;
    authorId: UserId;
    body: string;
    anchor: AnnotationAnchor;
    threadId?: AnnotationId;
    now?: number;
  },
): void {
  const ann = new Y.Map<unknown>();
  const body = new Y.Text();
  body.insert(0, input.body);

  ann.set(ANNOTATION_KEYS.id, input.id);
  ann.set(ANNOTATION_KEYS.authorId, input.authorId);
  ann.set(ANNOTATION_KEYS.createdAt, input.now ?? Date.now());
  ann.set(ANNOTATION_KEYS.body, body);
  ann.set(ANNOTATION_KEYS.anchor, input.anchor);
  if (input.threadId) ann.set(ANNOTATION_KEYS.threadId, input.threadId);
  ann.set(ANNOTATION_KEYS.resolved, false);

  getAnnotationsMap(doc).set(input.id, ann);
}

export function readAnnotation(doc: Y.Doc, id: AnnotationId): Annotation | undefined {
  const ann = getAnnotationsMap(doc).get(id);
  if (!(ann instanceof Y.Map)) return undefined;
  const bodyCell = ann.get(ANNOTATION_KEYS.body);
  const body = bodyCell instanceof Y.Text ? bodyCell.toString() : String(bodyCell ?? '');
  const threadId = ann.get(ANNOTATION_KEYS.threadId) as AnnotationId | undefined;
  const resolved = ann.get(ANNOTATION_KEYS.resolved) as boolean | undefined;
  return {
    id: ann.get(ANNOTATION_KEYS.id) as AnnotationId,
    authorId: ann.get(ANNOTATION_KEYS.authorId) as UserId,
    createdAt: ann.get(ANNOTATION_KEYS.createdAt) as number,
    body,
    anchor: ann.get(ANNOTATION_KEYS.anchor) as AnnotationAnchor,
    ...(threadId !== undefined ? { threadId } : {}),
    ...(resolved !== undefined ? { resolved } : {}),
  };
}

export function setAnnotationBody(doc: Y.Doc, id: AnnotationId, body: string): void {
  const ann = getAnnotationsMap(doc).get(id);
  if (!(ann instanceof Y.Map)) return;
  const t = ann.get(ANNOTATION_KEYS.body);
  if (t instanceof Y.Text) {
    t.delete(0, t.length);
    t.insert(0, body);
  }
}

export function resolveAnnotation(doc: Y.Doc, id: AnnotationId, resolved: boolean): void {
  const ann = getAnnotationsMap(doc).get(id);
  if (!(ann instanceof Y.Map)) return;
  ann.set(ANNOTATION_KEYS.resolved, resolved);
}

export function deleteAnnotation(doc: Y.Doc, id: AnnotationId): void {
  getAnnotationsMap(doc).delete(id);
}
