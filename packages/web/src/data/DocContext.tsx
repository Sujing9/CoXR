import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { toast } from 'sonner';
import type {
  FieldId,
  FieldValue,
  RecordDoc,
  RecordId,
  RecordTypeDef,
  RecordTypeId,
  SceneItem,
  SceneItemId,
  SerializedDoc,
  UserId,
  ViewConfig,
  ViewId,
} from '@coxr/shared';
import { useSyncExternalStore } from 'react';
import { getToken } from '../api/client';
import {
  createRecord,
  deleteRecord,
  deleteRecordType,
  deleteSceneItem,
  deleteView,
  getRecordsMap,
  getViewsMap,
  initYDoc,
  restoreDocFromSnapshot,
  toSerializedDoc,
  updateRecordField,
  upsertRecordType,
  upsertSceneItem,
  upsertView,
} from '@coxr/shared/yjs';
import { uuid } from '@coxr/shared';
import { useSpaceStore } from './spaceStore';
import { useSpaceUIStore } from './spaceUIStore';

// ─── 网络 Provider 管理 ──────────────────────────────────────────────────────

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3000/ws';

interface ProviderHandle {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  spaceId: string;
}

let activeHandle: ProviderHandle | null = null;

function destroyActiveProvider(): void {
  if (!activeHandle) return;
  activeHandle.provider.destroy();
  activeHandle = null;
}

function getOrCreateProvider(spaceId: string): ProviderHandle {
  if (activeHandle?.spaceId === spaceId) return activeHandle;

  destroyActiveProvider();

  const doc = new Y.Doc();
  initYDoc(doc);

  const provider = new HocuspocusProvider({
    url: WS_URL,
    name: `space:${spaceId}`,
    document: doc,
    token: getToken() ?? '',
  });

  activeHandle = { doc, provider, spaceId };
  return activeHandle;
}

// ─── YDoc snapshot hook（通用，接受外部 Y.Doc）────────────────────────────────

function makeSubscribeFns(docGetter: () => Y.Doc) {
  let cached: { doc: Y.Doc; snapshot: SerializedDoc } | null = null;

  const getSnapshot = (): SerializedDoc => {
    const doc = docGetter();
    if (!cached || cached.doc !== doc) {
      cached = { doc, snapshot: toSerializedDoc(doc) };
    }
    return cached.snapshot;
  };

  const subscribe = (onChange: () => void): (() => void) => {
    const doc = docGetter();
    const handler = () => {
      cached = { doc, snapshot: toSerializedDoc(doc) };
      onChange();
    };
    doc.on('update', handler);
    return () => doc.off('update', handler);
  };

  return { getSnapshot, subscribe };
}

function makeNullableSubscribeFns(docGetter: () => Y.Doc | null) {
  let cached: { doc: Y.Doc | null; snapshot: SerializedDoc | null } | null = null;

  const getSnapshot = (): SerializedDoc | null => {
    const doc = docGetter();
    if (!doc) {
      cached = { doc: null, snapshot: null };
      return null;
    }
    if (!cached || cached.doc !== doc) {
      cached = { doc, snapshot: toSerializedDoc(doc) };
    }
    return cached.snapshot;
  };

  const subscribe = (onChange: () => void): (() => void) => {
    const doc = docGetter();
    if (!doc) return () => {};

    const handler = () => {
      cached = { doc, snapshot: toSerializedDoc(doc) };
      onChange();
    };
    doc.on('update', handler);
    return () => doc.off('update', handler);
  };

  return { getSnapshot, subscribe };
}

/**
 * 文档上下文：
 *  - 当 spaceId 存在时，通过 Hocuspocus provider 接入网络 YDoc
 *  - 否则回退到本地单例 YDoc（seed mock 数据）
 */

interface DocContextValue {
  doc: SerializedDoc | null;
  activeViewId: ViewId | null;
  setActiveViewId: (id: ViewId) => void;
  // ── Record 操作 ──────────────────────────────────────────────────────────
  setRecordField: (recordId: RecordId, fieldId: FieldId, value: FieldValue) => void;
  addRecord: (typeId: RecordTypeId, data?: Record<string, FieldValue>) => RecordId | null;
  removeRecord: (id: RecordId) => void;
  // ── RecordType 操作 ──────────────────────────────────────────────────────
  upsertRecordType: (def: RecordTypeDef) => void;
  removeRecordType: (id: RecordTypeId) => void;
  // ── View 操作 ────────────────────────────────────────────────────────────
  upsertView: (view: ViewConfig) => void;
  removeView: (id: ViewId) => void;
  // ── SceneItem 操作 ───────────────────────────────────────────────────────
  upsertSceneItem: (item: SceneItem) => void;
  removeSceneItem: (id: SceneItemId) => void;
  // ── 批量导入 ──────────────────────────────────────────────────────────────
  /** 清空 rtId 下所有已有字段与记录，用新定义 + 新行数据覆盖写入（单次 Yjs transact）*/
  batchImportToRecordType: (
    rtId: RecordTypeId,
    newRtDef: RecordTypeDef,
    rows: Array<Record<string, FieldValue>>,
  ) => void;
  // ── 快照操作 ─────────────────────────────────────────────────────────────
  getDocAsBase64: () => string | null;
  restoreFromSnapshot: (base64: string) => void;
}

const DocContext = createContext<DocContextValue | null>(null);

function useDocSnapshot(spaceId: string | null): {
  doc: SerializedDoc | null;
  liveDoc: Y.Doc | null;
} {
  const docRef = useRef<Y.Doc | null>(null);
  const fnRef = useRef<ReturnType<typeof makeNullableSubscribeFns>>(
    makeNullableSubscribeFns(() => null),
  );

  if (spaceId) {
    const handle = getOrCreateProvider(spaceId);
    if (docRef.current !== handle.doc) {
      docRef.current = handle.doc;
      fnRef.current = makeNullableSubscribeFns(() => handle.doc);
    }
  } else if (docRef.current !== null) {
    docRef.current = null;
    fnRef.current = makeNullableSubscribeFns(() => null);
  }

  const { getSnapshot, subscribe } = fnRef.current;
  const doc = useSyncExternalStore<SerializedDoc | null>(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  return { doc, liveDoc: docRef.current };
}

export function DocProvider({
  spaceId,
  children,
}: {
  spaceId: string | null;
  children: ReactNode;
}) {
  const { doc, liveDoc } = useDocSnapshot(spaceId);
  const [activeViewId, setActiveViewId] = useState<ViewId | null>(null);

  useEffect(() => {
    if (!spaceId) {
      destroyActiveProvider();
    }
    setActiveViewId(null);
  }, [spaceId]);

  // ── Stateless message handler（kicked / refresh_members / new_application）──
  useEffect(() => {
    if (!spaceId) return;
    const handle = getOrCreateProvider(spaceId);

    const handleStateless = ({ payload }: { payload: string }) => {
      let event: { type: string };
      try {
        event = JSON.parse(payload) as { type: string };
      } catch {
        return;
      }

      const { type } = event;

      if (type === 'kicked') {
        // 被踢出：重置 UI、从列表移除该空间（同时清空 activeSpace）
        // 不在此直接销毁 provider，由 spaceId→null 触发的 React cleanup 负责
        useSpaceUIStore.getState().reset();
        useSpaceStore.getState().removeSpace(spaceId);
        toast.error('你已被管理员移出该空间', { duration: 5000 });
      } else if (type === 'refresh_members') {
        useSpaceUIStore.getState().incrementMemberListKey();
      } else if (type === 'new_application') {
        const { activeSpace } = useSpaceStore.getState();
        if ((activeSpace?.myRole ?? 0) >= 1) {
          toast.info('有新的加入申请', {
            description: '请前往成员管理查看',
            duration: 6000,
          });
        }
        useSpaceUIStore.getState().incrementApplicationListKey();
      } else if (type === 'refresh_applications') {
        useSpaceUIStore.getState().incrementApplicationListKey();
      }
    };

    handle.provider.on('stateless', handleStateless);
    return () => {
      handle.provider.off('stateless', handleStateless);
    };
  }, [spaceId]);

  useEffect(() => {
    if (!doc) {
      setActiveViewId(null);
      return;
    }

    setActiveViewId((current) => {
      if (current && doc.views[current]) return current;
      const nextViewId = Object.keys(doc.views)[0] as ViewId | undefined;
      return nextViewId ?? null;
    });
  }, [doc]);

  const setRecordField = useCallback(
    (recordId: RecordId, fieldId: FieldId, value: FieldValue) => {
      if (!liveDoc) return;
      updateRecordField(liveDoc, recordId, fieldId, value);
    },
    [liveDoc],
  );

  const addRecord = useCallback(
    (typeId: RecordTypeId, data: Record<string, FieldValue> = {}): RecordId | null => {
      if (!liveDoc) return null;
      const id = uuid() as unknown as RecordId;
      createRecord(liveDoc, { id, typeId, data, createdBy: 'local' as unknown as UserId });
      return id;
    },
    [liveDoc],
  );

  const removeRecord = useCallback(
    (id: RecordId) => {
      if (!liveDoc) return;
      deleteRecord(liveDoc, id);
    },
    [liveDoc],
  );

  const handleUpsertRecordType = useCallback(
    (def: RecordTypeDef) => {
      if (!liveDoc) return;
      upsertRecordType(liveDoc, def);
    },
    [liveDoc],
  );

  const removeRecordType = useCallback(
    (id: RecordTypeId) => {
      if (!liveDoc) return;
      deleteRecordType(liveDoc, id);
    },
    [liveDoc],
  );

  const handleUpsertView = useCallback(
    (view: ViewConfig) => {
      if (!liveDoc) return;
      upsertView(liveDoc, view);
    },
    [liveDoc],
  );

  const removeView = useCallback(
    (id: ViewId) => {
      if (!liveDoc) return;
      deleteView(liveDoc, id);
    },
    [liveDoc],
  );

  const handleUpsertSceneItem = useCallback(
    (item: SceneItem) => {
      if (!liveDoc) return;
      upsertSceneItem(liveDoc, item);
    },
    [liveDoc],
  );

  const removeSceneItem = useCallback(
    (id: SceneItemId) => {
      if (!liveDoc) return;
      deleteSceneItem(liveDoc, id);
    },
    [liveDoc],
  );

  const getDocAsBase64 = useCallback((): string | null => {
    if (!liveDoc) return null;
    const update = Y.encodeStateAsUpdate(liveDoc);
    return btoa(String.fromCharCode(...Array.from(update)));
  }, [liveDoc]);

  const batchImportToRecordType = useCallback(
    (rtId: RecordTypeId, newRtDef: RecordTypeDef, rows: Array<Record<string, FieldValue>>) => {
      if (!liveDoc) return;
      liveDoc.transact(() => {
        // 1. 覆盖写入新字段定义
        upsertRecordType(liveDoc, newRtDef);
        // 2. 同步所有引用该 recordTypeId 的视图的 fieldOrder
        const viewsMap = getViewsMap(liveDoc);
        for (const [, v] of viewsMap.entries()) {
          const view = v as ViewConfig;
          if (view.recordTypeId === rtId) {
            upsertView(liveDoc, {
              ...view,
              fieldOrder: [...newRtDef.fieldOrder] as FieldId[],
              fieldVisibility: {},
            });
          }
        }
        // 3. 删除该数据源下所有已有记录
        const recordsMap = getRecordsMap(liveDoc);
        for (const [recordId, rec] of recordsMap.entries()) {
          if (rec instanceof Y.Map && (rec.get('typeId') as string) === rtId) {
            recordsMap.delete(recordId);
          }
        }
        // 4. 批量写入新记录（共享同一时间戳以减少 Yjs 事务开销）
        const now = Date.now();
        for (const data of rows) {
          const id = uuid() as unknown as RecordId;
          createRecord(liveDoc, { id, typeId: rtId, data, createdBy: 'local' as unknown as UserId, now });
        }
      });
    },
    [liveDoc],
  );

  const restoreFromSnapshot = useCallback((base64: string): void => {
    if (!liveDoc) return;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    restoreDocFromSnapshot(liveDoc, bytes);
  }, [liveDoc]);

  const value = useMemo<DocContextValue>(
    () => ({
      doc,
      activeViewId,
      setActiveViewId,
      setRecordField,
      addRecord,
      removeRecord,
      upsertRecordType: handleUpsertRecordType,
      removeRecordType,
      upsertView: handleUpsertView,
      removeView,
      upsertSceneItem: handleUpsertSceneItem,
      removeSceneItem,
      batchImportToRecordType,
      getDocAsBase64,
      restoreFromSnapshot,
    }),
    [
      doc,
      activeViewId,
      setRecordField,
      addRecord,
      removeRecord,
      handleUpsertRecordType,
      removeRecordType,
      handleUpsertView,
      removeView,
      handleUpsertSceneItem,
      removeSceneItem,
      batchImportToRecordType,
      getDocAsBase64,
      restoreFromSnapshot,
    ],
  );
  return <DocContext.Provider value={value}>{children}</DocContext.Provider>;
}

export function useDoc(): DocContextValue {
  const v = useContext(DocContext);
  if (!v) throw new Error('useDoc must be used within <DocProvider>');
  return v;
}

