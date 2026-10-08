import { ArrowLeftIcon, Trash2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDoc } from '../../data/DocContext';
import { useSpaceUIStore } from '../../data/spaceUIStore';
import type { RecordId, FieldDef, FieldValue, RecordDoc, ViewId } from '@coxr/shared';

// ── Field detail row ──────────────────────────────────────────────────────────

function FieldDetailRow({
  field,
  value,
  record,
}: {
  field: FieldDef;
  value: FieldValue;
  record: RecordDoc;
}) {
  const { setRecordField } = useDoc();

  const renderEditor = () => {
    if (field.type === 'longText') {
      return (
        <textarea
          defaultValue={value == null ? '' : String(value)}
          onBlur={(e) => setRecordField(record.id, field.id, e.target.value || null)}
          rows={6}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-300 resize-none"
          placeholder="在此输入内容..."
        />
      );
    }

    if (field.type === 'boolean') {
      const checked = value === true;
      return (
        <button
          type="button"
          onClick={() => setRecordField(record.id, field.id, !checked)}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded border transition-colors',
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
      return (
        <input
          type={field.type === 'url' ? 'url' : 'text'}
          defaultValue={value == null ? '' : String(value)}
          onBlur={(e) => setRecordField(record.id, field.id, e.target.value || null)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
          placeholder="—"
        />
      );
    }

    if (field.type === 'number') {
      return (
        <input
          type="number"
          defaultValue={value == null ? '' : String(value)}
          onBlur={(e) =>
            setRecordField(
              record.id,
              field.id,
              e.target.value === '' ? null : Number(e.target.value),
            )
          }
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold tabular-nums text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
          placeholder="—"
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={value == null ? '' : String(value)}
          onChange={(e) => setRecordField(record.id, field.id, e.target.value || null)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold text-slate-800 outline-none hover:bg-slate-100"
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
        <div className="flex flex-wrap gap-2">
          {field.options.map((o) => {
            const active = arr.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => {
                  const next = active ? arr.filter((v) => v !== o.id) : [...arr, o.id];
                  setRecordField(record.id, field.id, next.length ? next : null);
                }}
                className="rounded-full px-3 py-1 text-sm font-bold transition-all border"
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
      return (
        <input
          type="date"
          defaultValue={iso}
          onBlur={(e) =>
            setRecordField(
              record.id,
              field.id,
              e.target.value ? new Date(e.target.value).getTime() : null,
            )
          }
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-bold tabular-nums text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
        />
      );
    }

    return <span className="text-sm font-bold text-slate-500">{String(value ?? '—')}</span>;
  };

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
        {field.name}
        <span className="ml-1.5 normal-case font-bold text-slate-400/60">{field.type}</span>
      </label>
      {renderEditor()}
    </div>
  );
}

// ── RecordDetailPanel ─────────────────────────────────────────────────────────

export function RecordDetailPanel({
  id,
  returnViewId,
}: {
  id: RecordId;
  returnViewId: ViewId;
}) {
  const { doc, removeRecord } = useDoc();
  const { focusView, clearFocus } = useSpaceUIStore();

  if (!doc) return null;
  const record = doc.records[id];
  if (!record) return null;
  const type = doc.recordTypes[record.typeId];
  if (!type) return null;

  const handleDelete = () => {
    removeRecord(id);
    if (returnViewId) {
      focusView(returnViewId);
    } else {
      clearFocus();
    }
  };

  return (
    <div className="flex h-full flex-col bg-white">
      {/* 顶部导航 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-4 py-2">
        <button
          onClick={() => focusView(returnViewId)}
          className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeftIcon size={14} /> 返回
        </button>
        <span className="text-sm font-bold text-slate-300">·</span>
        <span className="text-sm font-bold text-slate-700">{type.name}</span>
        <div className="ml-auto">
          <button
            onClick={handleDelete}
            className="rounded p-1.5 text-slate-300 hover:bg-red-100 hover:text-red-600 transition-colors"
            title="删除记录"
          >
            <Trash2Icon size={14} />
          </button>
        </div>
      </div>

      {/* 字段编辑区 */}
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {type.fieldOrder.map((fid) => {
          const f = type.fields[fid];
          if (!f) return null;
          return (
            <FieldDetailRow
              key={fid}
              field={f}
              value={record.data[fid] ?? null}
              record={record}
            />
          );
        })}
      </div>

      {/* 底部元信息 */}
      <div className="shrink-0 border-t border-slate-100 px-5 py-2 text-xs font-bold text-slate-400">
        创建于 {new Date(record.createdAt).toLocaleString()}
        {record.updatedAt !== record.createdAt && (
          <> · 更新于 {new Date(record.updatedAt).toLocaleString()}</>
        )}
      </div>
    </div>
  );
}
