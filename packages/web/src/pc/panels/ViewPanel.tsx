import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftIcon,
  PlusIcon,
  Trash2Icon,
  Settings2Icon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  applyView,
  type FieldDef,
  type FieldValue,
  type RecordDoc,
  type RecordId,
  type RecordTypeId,
  type ViewId,
} from '@coxr/shared';
import { uuid } from '@coxr/shared';
import { useDoc } from '../../data/DocContext';
import { useSpaceUIStore } from '../../data/spaceUIStore';

// ── 受控可编辑输入（协同安全：未聚焦时跟随远端值）────────────────────────────

function useCollabInput(remoteValue: string) {
  const [local, setLocal] = useState(remoteValue);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(remoteValue);
  }, [remoteValue]);

  return {
    value: local,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setLocal(e.target.value),
    onFocus: () => { focused.current = true; },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      focused.current = false;
      return e;
    },
  };
}

// ── Cell (inline-editable) ────────────────────────────────────────────────────

function EditableCell({
  field,
  value,
  record,
}: {
  field: FieldDef;
  value: FieldValue;
  record: RecordDoc;
}) {
  const { setRecordField } = useDoc();

  if (field.type === 'boolean') {
    const checked = value === true;
    return (
      <button
        type="button"
        onClick={() => setRecordField(record.id, field.id, !checked)}
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded border transition-colors',
          checked
            ? 'border-emerald-600 bg-emerald-100 text-emerald-700'
            : 'border-slate-300 bg-white text-slate-400 hover:border-slate-400',
        )}
      >
        {checked ? '✓' : ''}
      </button>
    );
  }

  if (field.type === 'text' || field.type === 'url') {
    const collab = useCollabInput(value == null ? '' : String(value));
    return (
      <input
        type={field.type === 'url' ? 'url' : 'text'}
        value={collab.value}
        onChange={collab.onChange}
        onFocus={collab.onFocus}
        onBlur={(e) => { collab.onBlur(e); setRecordField(record.id, field.id, e.target.value || null); }}
        className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-medium text-slate-800 outline-none focus:bg-slate-100 focus:ring-1 focus:ring-slate-300"
        placeholder="—"
      />
    );
  }

  if (field.type === 'number') {
    const collab = useCollabInput(value == null ? '' : String(value));
    return (
      <input
        type="number"
        value={collab.value}
        onChange={collab.onChange}
        onFocus={collab.onFocus}
        onBlur={(e) => {
          collab.onBlur(e);
          setRecordField(record.id, field.id, e.target.value === '' ? null : Number(e.target.value));
        }}
        className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-bold tabular-nums text-slate-800 outline-none focus:bg-slate-100 focus:ring-1 focus:ring-slate-300"
        placeholder="—"
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={value == null ? '' : String(value)}
        onChange={(e) => setRecordField(record.id, field.id, e.target.value || null)}
        className="w-full rounded bg-slate-100 px-1 py-0.5 text-sm font-medium text-slate-800 outline-none border border-slate-200"
      >
        <option value="" className="bg-white text-slate-800">—</option>
        {field.options.map((o) => (
          <option key={o.id} value={o.id} className="bg-white text-slate-800">{o.name}</option>
        ))}
      </select>
    );
  }

  if (field.type === 'multiSelect') {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1">
        {field.options.map((o) => {
          const active = arr.includes(o.id);
          return (
            <button
              key={o.id}
              onClick={() => {
                const next = active ? arr.filter((v) => v !== o.id) : [...arr, o.id];
                setRecordField(record.id, field.id, next.length ? next : null);
              }}
              className="rounded px-2 py-0.5 text-xs font-bold transition-all border"
              style={{
                backgroundColor: active ? (o.color ?? '#6b7280') : 'transparent',
                borderColor: o.color ?? '#6b7280',
                color: active ? '#ffffff' : (o.color ?? '#6b7280'),
                opacity: active ? 1 : 0.7,
              }}
            >
              {o.name}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'date') {
    const iso = value == null ? '' : new Date(Number(value)).toISOString().slice(0, 10);
    const collab = useCollabInput(iso);
    return (
      <input
        type="date"
        value={collab.value}
        onChange={collab.onChange}
        onFocus={collab.onFocus}
        onBlur={(e) => {
          collab.onBlur(e);
          setRecordField(record.id, field.id, e.target.value ? new Date(e.target.value).getTime() : null);
        }}
        className="w-full rounded bg-transparent px-1 py-0.5 text-sm font-medium tabular-nums text-slate-800 outline-none focus:bg-slate-100"
      />
    );
  }

  // longText — 只读摘要，点击跳转到 RecordDetail
  return (
    <span className="text-slate-500 line-clamp-1 text-sm font-medium">
      {value == null ? '—' : String(value).slice(0, 60)}
    </span>
  );
}

// ── ViewPanel ─────────────────────────────────────────────────────────────────

export function ViewPanel({ id }: { id: ViewId }) {
  const { doc, addRecord, removeRecord, removeView, upsertView } = useDoc();
  const { focusRecord, clearFocus } = useSpaceUIStore();
  const [showConfig, setShowConfig] = useState(false);

  if (!doc) return null;
  const view = doc.views[id];
  if (!view) return null;
  const type = doc.recordTypes[view.recordTypeId];
  if (!type) return null;

  const rows = applyView(doc, view);
  // 以 view.fieldOrder 为基础（保留用户自定义列顺序），
  // 再追加 type.fieldOrder 中尚未出现在视图里的新字段
  const mergedFieldOrder = [
    ...view.fieldOrder,
    ...type.fieldOrder.filter((fid) => !view.fieldOrder.includes(fid)),
  ];
  const visibleFields = mergedFieldOrder
    .filter((fid) => view.fieldVisibility[fid] !== false)
    .map((fid) => type.fields[fid])
    .filter((f): f is FieldDef => Boolean(f));

  const handleAddRecord = () => {
    const data: Record<string, FieldValue> = {};
    if (type.primaryFieldId) data[type.primaryFieldId] = '新记录';
    addRecord(view.recordTypeId, data);
  };

  const handleDeleteView = () => {
    removeView(id);
    clearFocus();
  };

  const toggleFieldVisibility = (fid: string) => {
    upsertView({
      ...view,
      fieldVisibility: {
        ...view.fieldVisibility,
        [fid]: view.fieldVisibility[fid] === false ? true : false,
      },
    });
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-white">
      {/* 顶部工具栏 */}
      <div className="flex shrink-0 flex-col gap-1 border-b border-slate-200 px-3 py-2">
        {/* 第一行：名称 + 操作按鈕 */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={view.name}
            onChange={(e) => upsertView({ ...view, name: e.target.value })}
            className="flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-bold text-slate-800 outline-none focus:bg-slate-100 focus:ring-1 focus:ring-slate-300"
            placeholder="视图名称"
          />
          <span className="text-xs font-bold text-slate-400">{rows.length} 条</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConfig((v) => !v)}
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs font-bold transition-colors',
                showConfig
                  ? 'bg-slate-200 text-slate-900'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
              )}
              title="字段可见性"
            >
              <SlidersHorizontalIcon size={13} />
            </button>
            <button
              onClick={handleAddRecord}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
            >
              <PlusIcon size={13} /> 新增
            </button>
            <button
              onClick={handleDeleteView}
              className="rounded p-1 text-slate-300 hover:bg-red-100 hover:text-red-600 transition-colors"
              title="删除视图"
            >
              <Trash2Icon size={13} />
            </button>
          </div>
        </div>
        {/* 第二行：数据源选择 */}
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs font-bold text-slate-400">数据源</span>
          <select
            value={view.recordTypeId}
            onChange={(e) => {
              const newTypeId = e.target.value as RecordTypeId;
              const newType = doc.recordTypes[newTypeId];
              if (!newType) return;
              upsertView({
                ...view,
                recordTypeId: newTypeId,
                fieldOrder: [...newType.fieldOrder],
                fieldVisibility: {},
                filter: [],
                sort: [],
              });
            }}
            className="flex-1 rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 outline-none hover:bg-slate-200"
          >
            {Object.values(doc.recordTypes).map((rt) => (
              <option key={rt.id} value={rt.id} className="bg-white text-slate-800">{rt.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 字段可见性面板 */}
      {showConfig && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
          {type.fieldOrder.map((fid) => {
            const f = type.fields[fid];
            if (!f) return null;
            const visible = view.fieldVisibility[fid] !== false;
            return (
              <button
                key={fid}
                onClick={() => toggleFieldVisibility(fid)}
                className={cn(
                  'rounded px-2 py-0.5 text-xs font-bold transition-colors border',
                  visible
                    ? 'bg-slate-200 border-slate-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-400',
                )}
              >
                {f.name}
              </button>
            );
          })}
        </div>
      )}

      {/* 表格 */}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="sticky top-0 border-b border-slate-200 bg-slate-50/90 text-left text-xs font-bold text-slate-600 backdrop-blur-sm">
              {visibleFields.map((f) => (
                <th key={f.id} className="px-3 py-2.5">{f.name}</th>
              ))}
              <th className="w-8 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="group border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
              >
                {visibleFields.map((f) => (
                  <td
                    key={f.id}
                    className="px-3 py-2 align-middle"
                    onClick={
                      f.type === 'longText'
                        ? () => focusRecord(r.id as RecordId, id)
                        : undefined
                    }
                  >
                    <EditableCell field={f} value={r.data[f.id] ?? null} record={r} />
                  </td>
                ))}
                <td className="px-2 py-1.5 text-right">
                  <button
                    onClick={() => focusRecord(r.id as RecordId, id)}
                    className="invisible rounded p-0.5 text-slate-400 hover:text-slate-800 group-hover:visible"
                    title="打开详情"
                  >
                    <Settings2Icon size={13} />
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={visibleFields.length + 1}
                  className="py-12 text-center text-sm font-bold text-slate-400"
                >
                  暂无记录
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
