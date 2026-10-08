// import type {
//   Bar3DItem,
//   FieldId,
//   RecordDoc,
//   RecordId,
//   RecordTypeDef,
//   RecordTypeId,
//   SceneItemId,
//   SerializedDoc,
//   UserId,
//   ViewConfig,
//   ViewId,
// } from '../types/index.js';
import { DOC_VERSION } from '../constants/index.js';
import type { SerializedDoc } from '../types/doc.js';
// import { asId } from '../types/ids.js';

// export const STARTER_USER_ID = asId<UserId>('00000000-0000-4000-8000-000000000001');

// const TYPE_TASK = asId<RecordTypeId>('22222222-2222-4222-8222-222222222222');

// const FIELD_TITLE = asId<FieldId>('a0000000-0000-4000-8000-000000000001');
// const FIELD_STATUS = asId<FieldId>('a0000000-0000-4000-8000-000000000002');
// const FIELD_PRIORITY = asId<FieldId>('a0000000-0000-4000-8000-000000000003');
// const FIELD_DONE = asId<FieldId>('a0000000-0000-4000-8000-000000000004');

// const MAIN_VIEW_ID = asId<ViewId>('c0000000-0000-4000-8000-000000000001');
// const CARDS_ITEM_ID = asId<SceneItemId>('d0000000-0000-4000-8000-000000000001');

// const STATUS_OPTIONS = [
//   { id: 'todo', name: '待办', color: '#9ca3af' },
//   { id: 'doing', name: '进行中', color: '#60a5fa' },
//   { id: 'done', name: '已完成', color: '#34d399' },
// ];

// const TASK_TYPE: RecordTypeDef = {
//   id: TYPE_TASK,
//   name: '任务',
//   primaryFieldId: FIELD_TITLE,
//   fields: {
//     [FIELD_TITLE]: { id: FIELD_TITLE, name: '标题', type: 'text' },
//     [FIELD_STATUS]: {
//       id: FIELD_STATUS,
//       name: '状态',
//       type: 'select',
//       options: STATUS_OPTIONS,
//     },
//     [FIELD_PRIORITY]: { id: FIELD_PRIORITY, name: '优先级', type: 'number' },
//     [FIELD_DONE]: { id: FIELD_DONE, name: '完成', type: 'boolean' },
//   },
//   fieldOrder: [FIELD_TITLE, FIELD_STATUS, FIELD_PRIORITY, FIELD_DONE],
// };

// const MAIN_VIEW: ViewConfig = {
//   id: MAIN_VIEW_ID,
//   name: '全部任务',
//   kind: 'table',
//   recordTypeId: TYPE_TASK,
//   filter: [],
//   sort: [{ fieldId: FIELD_PRIORITY, direction: 'asc' }],
//   group: null,
//   fieldVisibility: {
//     [FIELD_TITLE]: true,
//     [FIELD_STATUS]: true,
//     [FIELD_PRIORITY]: true,
//     [FIELD_DONE]: true,
//   },
//   fieldOrder: [FIELD_TITLE, FIELD_STATUS, FIELD_PRIORITY, FIELD_DONE],
// };

// const CHART_ITEM_ID = asId<SceneItemId>('d0000000-0000-4000-8000-000000000001');

// const CHART_ITEM: Bar3DItem = {
//   id: CHART_ITEM_ID,
//   kind: 'bar3d',
//   name: '任务优先级图',
//   sourceViewId: MAIN_VIEW_ID,
//   xField: FIELD_TITLE,
//   yField: FIELD_PRIORITY,
//   zField: null,
//   transform3d: {
//     position: [0, 0.3, -3],
//     rotation: [0, 0, 0],
//     scale: [1, 1, 1],
//   },
// };

// function createStarterRecord(
//   idSuffix: string,
//   title: string,
//   status: string,
//   priority: number,
//   done: boolean,
//   createdBy: UserId,
//   timestamp: number,
// ): RecordDoc {
//   const id = asId<RecordId>(`b0000000-0000-4000-8000-${idSuffix}`);
//   return {
//     id,
//     typeId: TYPE_TASK,
//     data: {
//       [FIELD_TITLE]: title,
//       [FIELD_STATUS]: status,
//       [FIELD_PRIORITY]: priority,
//       [FIELD_DONE]: done,
//     },
//     createdAt: timestamp,
//     updatedAt: timestamp,
//     createdBy,
//   };
// }

export function createStarterDoc(): SerializedDoc {
  return {
    meta: { docVersion: DOC_VERSION, title: 'CoXR 协同空间' },
    recordTypes: {},
    records: {},
    relations: {},
    views: {},
    scene: { items: {} },
    annotations: {},
  };
}