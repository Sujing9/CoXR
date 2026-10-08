import { useState } from 'react';
import { PlusIcon, Trash2Icon, ChevronUpIcon, ChevronDownIcon, DownloadIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDoc } from '@/data/DocContext';
import { useSpaceUIStore } from '@/data/spaceUIStore'; 
import type {
  FieldDef,
  FieldType,
  RecordTypeId,
  SelectOption,
} from '@coxr/shared';
import { uuid } from '@coxr/shared';
import { ImportDataModal } from './ImportDataModal';

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: '文本',
  longText: '长文本',
  number: '数字',
  boolean: '勾选',
  select: '单选',
  multiSelect: '多选',
  date: '日期',
  url: '链接',
};

const FIELD_TYPES: FieldType[] = [
  'text', 'longText', 'number', 'boolean', 'select', 'multiSelect', 'date', 'url',
];

// ── Select options editor ─────────────────────────────────────────────────────

const OPTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#3b82f6', '#14b8a6',
  '#f97316', '#84cc16', '#06b6d4', '#a855f7',
];

function randomOptionColor(existingColors: (string | undefined)[]): string {
  const unused = OPTION_COLORS.filter((c) => !existingColors.includes(c));
  const pool = unused.length > 0 ? unused : OPTION_COLORS;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (opts: SelectOption[]) => void;
}) {
  const addOption = () => {
    onChange([...options, { id: uuid(), name: '新选项', color: randomOptionColor(options.map((o) => o.color)) }]);
  };
  const updateOption = (idx: number, patch: Partial<SelectOption>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };
  const removeOption = (idx: number) => {
    onChange(options.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-2 space-y-1">
      {options.map((opt, i) => (
        <div key={opt.id} className="flex items-center gap-2">
          <input
            type="color"
            value={opt.color ?? '#6b7280'}
            onChange={(e) => updateOption(i, { color: e.target.value })}
            className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
          />
          <input
            type="text"
            value={opt.name}
            onChange={(e) => updateOption(i, { name: e.target.value })}
            className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
          />
          <button
            onClick={() => removeOption(i)}
            className="text-slate-400 hover:text-red-600 transition-colors"
          >
            <Trash2Icon size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={addOption}
        className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <PlusIcon size={12} /> 添加选项
      </button>
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────

function FieldRow({
  field,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: FieldDef;
  onUpdate: (patch: Partial<FieldDef>) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 flex-col">
          <button onClick={onMoveUp} disabled={!onMoveUp} className="text-slate-300 hover:text-slate-600 disabled:opacity-0 transition-colors"><ChevronUpIcon size={11} /></button>
          <button onClick={onMoveDown} disabled={!onMoveDown} className="text-slate-300 hover:text-slate-600 disabled:opacity-0 transition-colors"><ChevronDownIcon size={11} /></button>
        </div>
        <input
          type="text"
          value={field.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="flex-1 rounded bg-transparent px-1 py-0.5 text-sm font-bold text-slate-800 outline-none focus:bg-slate-100"
        />
        {(field.type === 'select' || field.type === 'multiSelect') && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-xs font-bold transition-colors border',
              expanded
                ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800',
            )}
          >
            {expanded ? '收起' : '选项'}
          </button>
        )}
        <select
          value={field.type}
          onChange={(e) => {
            const t = e.target.value as FieldType;
            const patch: Record<string, unknown> = { type: t };
            if (t === 'select' || t === 'multiSelect') {
              if (!('options' in field)) patch.options = [];
            }
            // 切换离开 select/multiSelect 时收起选项面板
            if (t !== 'select' && t !== 'multiSelect') setExpanded(false);
            onUpdate(patch as Partial<FieldDef>);
          }}
          className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-bold text-slate-600 outline-none hover:bg-slate-100"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t} className="bg-white text-slate-800">
              {FIELD_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <button
          onClick={onDelete}
          className="text-slate-300 hover:text-red-600 transition-colors"
        >
          <Trash2Icon size={13} />
        </button>
      </div>

      {expanded && (field.type === 'select' || field.type === 'multiSelect') && (
        <OptionsEditor
          options={field.options}
          onChange={(opts) => onUpdate({ options: opts } as Partial<FieldDef>)}
        />
      )}
    </div>
  );
}

// ── RecordTypePanel ───────────────────────────────────────────────────────────

export function RecordTypePanel({ id }: { id: RecordTypeId }) {
  const { doc, upsertRecordType, removeRecordType, removeView, removeSceneItem } = useDoc();
  const { clearFocus } = useSpaceUIStore();
  const [importOpen, setImportOpen] = useState(false);

  if (!doc) return null;
  const rt = doc.recordTypes[id];
  if (!rt) return null;

  const updateName = (name: string) => {
    upsertRecordType({ ...rt, name });
  };

  const addField = () => {
    const fid = uuid();
    const newField: FieldDef = { id: fid as any, name: '新字段', type: 'text' };
    upsertRecordType({
      ...rt,
      fields: { ...rt.fields, [fid]: newField },
      fieldOrder: [...rt.fieldOrder, fid as any],
    });
  };

  const updateField = (fid: string, patch: Partial<FieldDef>) => {
    upsertRecordType({
      ...rt,
      fields: { ...rt.fields, [fid]: { ...rt.fields[fid], ...patch } as FieldDef },
    });
  };

  const deleteField = (fid: string) => {
    const { [fid]: _, ...rest } = rt.fields;
    upsertRecordType({
      ...rt,
      fields: rest,
      fieldOrder: rt.fieldOrder.filter((f) => f !== fid),
    });
  };

  const moveField = (fid: string, dir: -1 | 1) => {
    const order = [...rt.fieldOrder];
    const idx = order.indexOf(fid as any);
    if (idx < 0) return;
    const next = idx + dir;
    if (next < 0 || next >= order.length) return;
    const tmp = order[idx]!;
    order[idx] = order[next]!;
    order[next] = tmp;
    upsertRecordType({ ...rt, fieldOrder: order });
  };

  const handleDelete = () => {
    // 级联删除：先删使用该数据源的场景元素，再删视图，最后删数据源
    const affectedViewIds = Object.values(doc.views)
      .filter((v) => v.recordTypeId === id)
      .map((v) => v.id);
    Object.values(doc.scene.items)
      .filter((item) => 'sourceViewId' in item && affectedViewIds.includes((item as any).sourceViewId))
      .forEach((item) => removeSceneItem(item.id));
    affectedViewIds.forEach((vid) => removeView(vid));
    removeRecordType(id);
    clearFocus();
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white min-h-full">
      {/* 标题行 */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={rt.name}
          onChange={(e) => updateName(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-base font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-300"
          placeholder="数据源名称"
        />
        <button
          onClick={() => setImportOpen(true)}
          className="rounded p-1.5 text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
          title="导入数据"
        >
          <DownloadIcon size={16} />
        </button>
        <button
          onClick={handleDelete}
          className="rounded p-1.5 text-slate-400 hover:bg-red-100 hover:text-red-600 transition-colors"
          title="删除数据源"
        >
          <Trash2Icon size={16} />
        </button>
      </div>

      <ImportDataModal open={importOpen} onClose={() => setImportOpen(false)} rtId={id} />

      {/* 字段列表 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            字段
          </span>
          <button
            onClick={addField}
            className={cn(
              'flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold',
              'text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors',
            )}
          >
            <PlusIcon size={12} /> 添加字段
          </button>
        </div>
        <div className="space-y-2">
          {rt.fieldOrder.map((fid, idx) => {
            const f = rt.fields[fid];
            if (!f) return null;
            return (
              <FieldRow
                key={fid}
                field={f}
                onUpdate={(patch) => updateField(fid, patch)}
                onDelete={() => deleteField(fid)}
                onMoveUp={idx > 0 ? () => moveField(fid, -1) : undefined}
                onMoveDown={idx < rt.fieldOrder.length - 1 ? () => moveField(fid, 1) : undefined}
              />
            );
          })}
          {rt.fieldOrder.length === 0 && (
            <p className="py-6 text-center text-sm font-bold text-slate-400">暂无字段，点击上方添加</p>
          )}
        </div>
      </div>

      {/* 记录统计 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
        共 {Object.values(doc.records).filter((r) => r.typeId === id).length} 条记录
      </div>
    </div>
  );
}
