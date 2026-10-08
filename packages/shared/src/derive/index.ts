import type { FieldValue } from '../types/field.js';
import type { RecordDoc } from '../types/record.js';
import type { SerializedDoc } from '../types/doc.js';
import type { FilterClause, SortClause, ViewConfig } from '../types/view.js';

/**
 * 纯函数派生层：吃 `SerializedDoc` 出"视图应用后的行集合"。
 * 不感知 React / Yjs / 持久化 —— server 端、web 端都能复用。
 *
 * MVP 范围：
 *   - filter：支持 FILTER_OPS 全部算子
 *   - sort：多键排序
 *   - group：暂不实际分组，仅保留接口（返回平铺行）
 */

function cmp(a: FieldValue, b: FieldValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b));
}

function isEmpty(v: FieldValue): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.length === 0;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function evalFilter(value: FieldValue, clause: FilterClause): boolean {
  const target = clause.value ?? null;
  switch (clause.op) {
    case 'eq':
      return value === target;
    case 'neq':
      return value !== target;
    case 'contains':
      return (
        typeof value === 'string' &&
        typeof target === 'string' &&
        value.toLowerCase().includes(target.toLowerCase())
      );
    case 'gt':
      return cmp(value, target) > 0;
    case 'lt':
      return cmp(value, target) < 0;
    case 'gte':
      return cmp(value, target) >= 0;
    case 'lte':
      return cmp(value, target) <= 0;
    case 'isEmpty':
      return isEmpty(value);
    case 'isNotEmpty':
      return !isEmpty(value);
  }
}

function applyFilter(rows: RecordDoc[], filters: FilterClause[]): RecordDoc[] {
  if (filters.length === 0) return rows;
  return rows.filter((r) =>
    filters.every((f) => evalFilter(r.data[f.fieldId] ?? null, f)),
  );
}

function applySort(rows: RecordDoc[], sorts: SortClause[]): RecordDoc[] {
  if (sorts.length === 0) return rows;
  const copy = rows.slice();
  copy.sort((a, b) => {
    for (const s of sorts) {
      const d = cmp(a.data[s.fieldId] ?? null, b.data[s.fieldId] ?? null);
      if (d !== 0) return s.direction === 'asc' ? d : -d;
    }
    return 0;
  });
  return copy;
}

/**
 * 对 view 对应 recordType 的记录应用 filter + sort，返回行集合。
 * 当前不实现 group（MVP 边界）。
 */
export function applyView(doc: SerializedDoc, view: ViewConfig): RecordDoc[] {
  const rows = Object.values(doc.records).filter(
    (r) => r.typeId === view.recordTypeId,
  );
  return applySort(applyFilter(rows, view.filter), view.sort);
}

/** 便捷：按 viewId 应用。找不到 view 时返回空数组。 */
export function applyViewById(
  doc: SerializedDoc,
  viewId: string,
): RecordDoc[] {
  const view = doc.views[viewId];
  if (!view) return [];
  return applyView(doc, view);
}
