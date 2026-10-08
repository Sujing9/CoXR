import type { FieldId, RecordTypeId, ViewId } from './ids.js';
import type { FilterOp, SortDirection, ViewKind } from '../constants/index.js';
import type { FieldValue } from './field.js';

export interface FilterClause {
  fieldId: FieldId;
  op: FilterOp;
  value?: FieldValue;
}

export interface SortClause {
  fieldId: FieldId;
  direction: SortDirection;
}

export interface GroupClause {
  fieldId: FieldId;
}

/**
 * 视图配置：查询意图 + 展示配置，与渲染形式解耦。
 * PC 2D 表格 overlay 直接消费；scene 中的 CardsItem / ChartItem 通过 sourceViewId 间接消费。
 */
export interface ViewConfig {
  id: ViewId;
  name: string;
  kind: ViewKind;
  recordTypeId: RecordTypeId;
  filter: FilterClause[];
  sort: SortClause[];
  group: GroupClause | null;
  fieldVisibility: { [fieldId: string]: boolean };
  fieldOrder: FieldId[];
}
