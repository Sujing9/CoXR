import * as Y from 'yjs';
import type { ViewId } from '../types/ids.js';
import type { ViewConfig } from '../types/view.js';
import { getViewsMap } from './doc.js';

export function upsertView(doc: Y.Doc, view: ViewConfig): void {
  getViewsMap(doc).set(view.id, view);
}

export function deleteView(doc: Y.Doc, id: ViewId): void {
  getViewsMap(doc).delete(id);
}

export function readView(doc: Y.Doc, id: ViewId): ViewConfig | undefined {
  return getViewsMap(doc).get(id) as ViewConfig | undefined;
}
