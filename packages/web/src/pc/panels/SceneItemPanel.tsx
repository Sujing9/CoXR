import { useState } from 'react';
import { Trash2Icon, SparklesIcon, CheckIcon } from 'lucide-react';
import { getNextSceneItemName } from '@/lib/autoName';
import { cn } from '@/lib/utils';
import { useDoc } from '../../data/DocContext';
import { useSpaceUIStore } from '../../data/spaceUIStore';
import { aiApi } from '../../api/ai';
import type { ChartRecommendation } from '../../api/ai';
import type {
  Bar3DItem,
  Scatter3DItem,
  Line3DItem,
  FieldDef,
  SceneItemId,
  ViewId,
  FieldId,
  SerializedDoc,
  Transform3D,
  Vec3,
} from '@coxr/shared';

// ── 场景元素类型定义 ──────────────────────────────────────────────────────────

const SCENE_ITEM_TYPE_LABELS: Record<string, string> = {
  bar3d: '3D 柱状图',
  scatter3d: '3D 散点图',
  line3d: '3D 折线图',
};
const SCENE_ITEM_TYPES = ['bar3d', 'scatter3d', 'line3d'] as const;
type SelectableKind = (typeof SCENE_ITEM_TYPES)[number];

// ── 默认值工厂 ────────────────────────────────────────────────────────────────

function makeDefaultBar3D(id: SceneItemId, sourceViewId: ViewId, name = '新图表'): Bar3DItem {
  return {
    id,
    kind: 'bar3d',
    name,
    sourceViewId,
    xField: null,
    yField: null,
    zField: null,
    transform3d: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  };
}

function makeDefaultScatter3D(id: SceneItemId, sourceViewId: ViewId, name = '新图表'): Scatter3DItem {
  return {
    id,
    kind: 'scatter3d',
    name,
    sourceViewId,
    xField: null,
    yField: null,
    zField: null,
    colorField: null,
    sizeField: null,
    transform3d: { position: [0, 0.3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  };
}

function makeDefaultLine3D(id: SceneItemId, sourceViewId: ViewId, name = '新图表'): Line3DItem {
  return {
    id,
    kind: 'line3d',
    name,
    sourceViewId,
    xField: null,
    yField: null,
    colorField: null,
    transform3d: { position: [0, 0.3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  };
}

// ── SceneItemPanel ────────────────────────────────────────────────────────────

export function SceneItemPanel({ id }: { id: SceneItemId }) {
  const { doc, upsertSceneItem, removeSceneItem } = useDoc();
  const { clearFocus } = useSpaceUIStore();

  if (!doc) return null;
  const item = doc.scene.items[id];
  if (!item) return null;

  const handleDelete = () => {
    removeSceneItem(id);
    clearFocus();
  };

  const handleNameChange = (name: string) => {
    if (item.kind === 'bar3d' || item.kind === 'scatter3d' || item.kind === 'line3d') {
      upsertSceneItem({ ...item, name });
    }
  };

  // 切换类型：仅在不同类型时才重置为默认值
  const handleKindChange = (newKind: SelectableKind) => {
    if (item.kind === newKind) return;
    const rawItem = item as { sourceViewId?: ViewId };
    const sourceViewId: ViewId = rawItem.sourceViewId ?? (Object.keys(doc.views)[0] as ViewId);
    const nextName = ('name' in item && item.name)
      ? item.name
      : getNextSceneItemName(Object.values(doc.scene.items).map((sceneItem) => ('name' in sceneItem ? sceneItem.name ?? '' : '')));
    if (newKind === 'bar3d') {
      upsertSceneItem(makeDefaultBar3D(id, sourceViewId, nextName));
    } else if (newKind === 'scatter3d') {
      upsertSceneItem(makeDefaultScatter3D(id, sourceViewId, nextName));
    } else if (newKind === 'line3d') {
      upsertSceneItem(makeDefaultLine3D(id, sourceViewId, nextName));
    }
  };

  const displayName = (item.kind === 'bar3d' || item.kind === 'scatter3d' || item.kind === 'line3d') ? (item.name ?? '') : '';;
  const currentKind: string = item.kind;

  return (
    <div className="flex h-full flex-col bg-white select-none">
      {/* 顶部：名称 + 删除 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-300 bg-slate-50 px-4 py-3">
        {item.kind !== 'label' ? (
          <input
            type="text"
            value={displayName}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="图表名称"
            className="flex-1 rounded border-transparent bg-transparent px-2 py-1 text-base font-black text-slate-900 outline-none transition-all hover:bg-white/80 focus:bg-white focus:ring-2 focus:ring-indigo-500/30"
          />
        ) : (
          <span className="flex-1 px-2 py-1 text-base font-black text-slate-900">标签</span>
        )}
        <span className="shrink-0 font-mono text-xs font-black uppercase text-slate-900 bg-slate-200 px-2 py-1 rounded">
          #{id.slice(0, 6)}
        </span>
        <button
          onClick={handleDelete}
          className="ml-1 rounded-md p-2 text-slate-900 hover:bg-red-100 hover:text-red-700 transition-all active:scale-95"
          title="删除场景元素"
        >
          <Trash2Icon size={18} />
        </button>
      </div>

      {/* 配置区 */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4 custom-scrollbar">
        {/* Step 1：选择视图 */}
        <ConfigSection label="1. 数据视图">
          <select
            value={(item.kind === 'bar3d' || item.kind === 'scatter3d' || item.kind === 'line3d') ? item.sourceViewId : ''}
            onChange={(e) => {
              if (item.kind === 'bar3d') {
                upsertSceneItem({ ...item, sourceViewId: e.target.value as ViewId, xField: null, yField: null, zField: null });
              } else if (item.kind === 'scatter3d') {
                upsertSceneItem({ ...item, sourceViewId: e.target.value as ViewId, xField: null, yField: null, zField: null, colorField: null, sizeField: null });
              } else if (item.kind === 'line3d') {
                upsertSceneItem({ ...item, sourceViewId: e.target.value as ViewId, xField: null, yField: null, colorField: null });
              }
            }}
            disabled={item.kind === 'label'}
            className="w-full rounded-lg border-2 border-slate-300 bg-white px-3 py-2.5 text-base font-black text-slate-900 outline-none transition-all hover:border-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 disabled:bg-slate-50 disabled:text-slate-500"
          >
            {Object.values(doc.views).map((v) => (
              <option key={v.id} value={v.id} className="bg-white text-slate-900 font-black">
                {v.name} · {doc.recordTypes[v.recordTypeId]?.name ?? ''}
              </option>
            ))}
          </select>
        </ConfigSection>

        {/* Step 2：元素类型 */}
        <ConfigSection label="2. 元素类型">
          <div className="flex gap-2">
            {SCENE_ITEM_TYPES.map((k) => (
              <button
                key={k}
                onClick={() => handleKindChange(k)}
                className={cn(
                  'flex-1 rounded-xl px-3 py-3 text-sm font-black uppercase tracking-tight transition-all border-2',
                  currentKind === k
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-300'
                    : 'bg-white border-slate-300 text-slate-900 hover:border-slate-500 hover:bg-slate-50',
                )}
              >
                {SCENE_ITEM_TYPE_LABELS[k]}
              </button>
            ))}
          </div>
        </ConfigSection>

        {/* AI 推荐 */}
        {(item.kind === 'bar3d' || item.kind === 'scatter3d' || item.kind === 'line3d') && (
          <AiRecommendSection
            doc={doc}
            sourceViewId={item.sourceViewId}
            onApply={(rec) => {
              handleKindChange(rec.chartType);
              const m = rec.fieldMappings;
              if (rec.chartType === 'bar3d') {
                upsertSceneItem({
                  ...item,
                  kind: 'bar3d',
                  xField: (m.xField ?? null) as FieldId | null,
                  yField: (m.yField ?? null) as FieldId | null,
                  zField: (m.zField ?? null) as FieldId | null,
                });
              } else if (rec.chartType === 'scatter3d') {
                upsertSceneItem({
                  ...item,
                  kind: 'scatter3d',
                  xField: (m.xField ?? null) as FieldId | null,
                  yField: (m.yField ?? null) as FieldId | null,
                  zField: (m.zField ?? null) as FieldId | null,
                  colorField: (m.colorField ?? null) as FieldId | null,
                  sizeField: (m.sizeField ?? null) as FieldId | null,
                });
              } else if (rec.chartType === 'line3d') {
                upsertSceneItem({
                  ...item,
                  kind: 'line3d',
                  xField: (m.xField ?? null) as FieldId | null,
                  yField: (m.yField ?? null) as FieldId | null,
                  colorField: (m.colorField ?? null) as FieldId | null,
                });
              }
            }}
          />
        )}

        {/* Step 3：轴映射（bar3d 专属） */}
        {item.kind === 'bar3d' && (
          <Bar3DConfig
            item={item}
            doc={doc}
            onUpdate={(patch) => upsertSceneItem({ ...item, ...patch })}
          />
        )}

        {/* Step 3：轴映射（scatter3d 专属） */}
        {item.kind === 'scatter3d' && (
          <Scatter3DConfig
            item={item}
            doc={doc}
            onUpdate={(patch) => upsertSceneItem({ ...item, ...patch })}
          />
        )}

        {/* Step 3：字段映射（line3d 专属） */}
        {item.kind === 'line3d' && (
          <Line3DConfig
            item={item}
            doc={doc}
            onUpdate={(patch) => upsertSceneItem({ ...item, ...patch })}
          />
        )}

        {/* Transform */}
        {(item.kind === 'bar3d' || item.kind === 'scatter3d' || item.kind === 'line3d') && (
          <TransformConfig
            transform={item.transform3d}
            onChange={(t) => upsertSceneItem({ ...item, transform3d: t })}
          />
        )}
      </div>
    </div>
  );
}

// ── 通用布局容器 ──────────────────────────────────────────────────────────────

function ConfigSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-black uppercase tracking-widest text-slate-700">{label}</p>
      {children}
    </div>
  );
}

// ── AI 推荐区块 ───────────────────────────────────────────────────────────────

const CHART_TYPE_LABELS: Record<string, string> = {
  bar3d:     '3D 柱状图',
  scatter3d: '3D 散点图',
  line3d:    '3D 折线图',
};

function AiRecommendSection({
  doc,
  sourceViewId,
  onApply,
}: {
  doc: SerializedDoc;
  sourceViewId: string;
  onApply: (rec: ChartRecommendation) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recs, setRecs] = useState<ChartRecommendation[] | null>(null);
  const [appliedIdx, setAppliedIdx] = useState<number | null>(null);

  const view = doc.views[sourceViewId];
  const recordType = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const fields: FieldDef[] = recordType
    ? (recordType.fieldOrder.map((fid) => recordType.fields[fid]).filter(Boolean) as FieldDef[])
    : [];

  const handleRecommend = async () => {
    if (fields.length === 0) return;
    setLoading(true);
    setError(null);
    setRecs(null);
    setAppliedIdx(null);
    try {
      const res = await aiApi.recommendChart(
        fields.map((f) => ({ id: f.id, name: f.name, type: f.type })),
      );
      setRecs(res.recommendations);
    } catch (e: any) {
      setError(e?.message ?? 'AI 推荐失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-indigo-50 border-2 border-indigo-300">
      {/* 跑马灯流动边框，仅在加载态显示 */}
      {loading && (
        <div className="pointer-events-none absolute inset-0">
          <style>{`
            @keyframes svg-border-flow {
              0% { stroke-dashoffset: 100; }
              100% { stroke-dashoffset: 0; }
            }
            .animate-svg-border-flow {
              animation: svg-border-flow 2.5s linear infinite;
            }
          `}</style>
          <svg
            className="absolute inset-0 h-full w-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="ai-glow-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#4f46e5" />
                <stop offset="100%" stopColor="#9333ea" />
              </linearGradient>
              <mask id="ai-comet-mask">
                {Array.from({ length: 30 }).map((_, i) => {
                  const opacity = 1 - Math.pow(i / 29, 1.5);
                  const delay = -5 + (i * 0.02);
                  return (
                    <rect
                      key={i}
                      x="0.5"
                      y="0.5"
                      width="calc(100% - 1px)"
                      height="calc(100% - 1px)"
                      rx="10"
                      fill="none"
                      stroke="white"
                      strokeWidth="6"
                      strokeLinecap="round"
                      pathLength="100"
                      strokeDasharray="3 97"
                      className="animate-svg-border-flow"
                      style={{
                        opacity,
                        animationDelay: `${delay}s`,
                      }}
                    />
                  );
                })}
              </mask>
            </defs>
            <rect
              x="0.5"
              y="0.5"
              width="calc(100% - 1px)"
              height="calc(100% - 1px)"
              rx="10"
              fill="none"
              stroke="url(#ai-glow-gradient)"
              strokeWidth="3"
              mask="url(#ai-comet-mask)"
            />
          </svg>
        </div>
      )}

      {/* 内部内容区 */}
      <div className="relative z-10 space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-indigo-800">
            <SparklesIcon size={16} className="fill-indigo-600/30" />
            AI 智能推荐
          </span>
        <button
          onClick={handleRecommend}
          disabled={loading || fields.length === 0}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-black text-white shadow-md ring-1 ring-indigo-900 transition-all hover:bg-indigo-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? '分析中…' : '即刻分析'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-sm font-black text-red-700 border-2 border-red-300">{error}</p>
      )}

      {recs && recs.length > 0 && (
        <div className="space-y-4">
          {recs.map((rec, idx) => (
            <div
              key={idx}
              className="rounded-xl border-2 border-indigo-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-400 space-y-3"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded bg-indigo-700 px-3 py-1 text-xs font-black uppercase text-white shadow-sm">
                  {CHART_TYPE_LABELS[rec.chartType] ?? rec.chartType}
                </span>
                <button
                  onClick={() => { onApply(rec); setAppliedIdx(idx); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-black transition-all border-2',
                    appliedIdx === idx
                      ? 'bg-emerald-100 border-emerald-600 text-emerald-800 shadow-sm shadow-emerald-200'
                      : 'bg-white border-slate-400 text-slate-900 hover:border-slate-900 hover:bg-slate-50',
                  )}
                >
                  {appliedIdx === idx ? <><CheckIcon size={14} strokeWidth={4} />已应用</> : '应用方案'}
                </button>
              </div>
              <p className="text-xs font-black leading-relaxed text-slate-900">{rec.reason}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                {Object.entries(rec.fieldMappings)
                  .filter(([, v]) => v != null)
                  .map(([axis, fieldId]) => {
                    const fieldName = recordType?.fields[fieldId as string]?.name ?? fieldId;
                    return (
                      <span key={axis} className="rounded-md bg-slate-200 border-2 border-slate-300 px-2 py-1 text-[11px] font-black text-slate-800">
                        {axis.toUpperCase()} → <span className="text-indigo-800">{fieldName}</span>
                      </span>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

// ── Bar3D 轴配置 ──────────────────────────────────────────────────────────────

function Bar3DConfig({
  item,
  doc,
  onUpdate,
}: {
  item: Bar3DItem;
  doc: SerializedDoc;
  onUpdate: (patch: Partial<Bar3DItem>) => void;
}) {
  const view = doc.views[item.sourceViewId];
  const type = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const fields: FieldDef[] = type
    ? (type.fieldOrder.map((fid) => type.fields[fid]).filter(Boolean) as FieldDef[])
    : [];

  const axes: { key: keyof Pick<Bar3DItem, 'xField' | 'yField' | 'zField'>; label: string; hint: string }[] = [
    { key: 'xField', label: 'X 轴 · 类别', hint: '文本/选项' },
    { key: 'yField', label: 'Y 轴 · 高度', hint: '数值' },
    { key: 'zField', label: 'Z 轴 · 分组', hint: '文本/选项 (可选)' },
  ];

  return (
    <ConfigSection label="3. 轴映射配置">
      <div className="space-y-4 rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
        {axes.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1.5 focus-within:text-indigo-700">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-black text-slate-800 transition-colors">{label}</label>
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{hint}</span>
            </div>
            <select
              value={item[key] ?? ''}
              onChange={(e) => onUpdate({ [key]: (e.target.value as FieldId) || null })}
              className="w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2.5 text-base font-black text-slate-900 outline-none transition-all hover:border-slate-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            >
              <option value="" className="bg-white text-slate-600 font-black italic">— 请选择字段 —</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id} className="bg-white text-slate-900 font-black">{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

// ── Scatter3D 轴配置 ───────────────────────────────────────────────────────────

function Scatter3DConfig({
  item,
  doc,
  onUpdate,
}: {
  item: Scatter3DItem;
  doc: SerializedDoc;
  onUpdate: (patch: Partial<Scatter3DItem>) => void;
}) {
  const view = doc.views[item.sourceViewId];
  const type = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const fields: FieldDef[] = type
    ? (type.fieldOrder.map((fid) => type.fields[fid]).filter(Boolean) as FieldDef[])
    : [];

  const axes: { key: keyof Pick<Scatter3DItem, 'xField' | 'yField' | 'zField' | 'colorField' | 'sizeField'>; label: string; hint: string; optional?: boolean }[] = [
    { key: 'xField',     label: 'X 轴位置',        hint: '数值' },
    { key: 'yField',     label: 'Y 轴位置',        hint: '数值' },
    { key: 'zField',     label: 'Z 轴位置',        hint: '数值 (可选)', optional: true },
    { key: 'colorField', label: '视觉颜色',        hint: '文本/选项 (可选)', optional: true },
    { key: 'sizeField',  label: '标记大小',        hint: '数值 (可选)', optional: true },
  ];

  return (
    <ConfigSection label="3. 字段映射配置">
      <div className="space-y-4 rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
        {axes.map(({ key, label, hint, optional }) => (
          <div key={key} className="space-y-1.5 focus-within:text-indigo-700">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-black text-slate-800 transition-colors">{label}</label>
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{hint}</span>
            </div>
            <select
              value={item[key] ?? ''}
              onChange={(e) => onUpdate({ [key]: (e.target.value as FieldId) || null })}
              className="w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2.5 text-base font-black text-slate-900 outline-none transition-all hover:border-slate-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            >
              <option value="" className="bg-white text-slate-600 font-black italic">{optional ? '— 跳过此项 —' : '— 必须选择 —'}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id} className="bg-white text-slate-900 font-black">{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

// ── Line3D 字段配置 ────────────────────────────────────────────────────────────

function Line3DConfig({
  item,
  doc,
  onUpdate,
}: {
  item: Line3DItem;
  doc: SerializedDoc;
  onUpdate: (patch: Partial<Line3DItem>) => void;
}) {
  const view = doc.views[item.sourceViewId];
  const type = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const fields: FieldDef[] = type
    ? (type.fieldOrder.map((fid) => type.fields[fid]).filter(Boolean) as FieldDef[])
    : [];

  const axes: { key: keyof Pick<Line3DItem, 'xField' | 'yField' | 'colorField'>; label: string; hint: string; optional?: boolean }[] = [
    { key: 'xField',     label: '横轴 (时间/分类)', hint: '文本/日期' },
    { key: 'yField',     label: '纵轴 (关键指标)',  hint: '数值' },
    { key: 'colorField', label: '对比分组',          hint: '文本/选项 (可选)', optional: true },
  ];

  return (
    <ConfigSection label="3. 数据映射配置">
      <div className="space-y-4 rounded-xl border-2 border-slate-300 bg-slate-50 p-4">
        {axes.map(({ key, label, hint, optional }) => (
          <div key={key} className="space-y-1.5 focus-within:text-indigo-700">
            <div className="flex items-center justify-between px-1">
              <label className="text-xs font-black text-slate-800 transition-colors">{label}</label>
              <span className="text-[10px] font-black uppercase tracking-tighter text-slate-600">{hint}</span>
            </div>
            <select
              value={item[key] ?? ''}
              onChange={(e) => onUpdate({ [key]: (e.target.value as FieldId) || null })}
              className="w-full rounded-lg border-2 border-slate-400 bg-white px-3 py-2.5 text-base font-black text-slate-900 outline-none transition-all hover:border-slate-600 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            >
              <option value="" className="bg-white text-slate-600 font-black italic">{optional ? '— 跳过 —' : '— 请选择 —'}</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id} className="bg-white text-slate-900 font-black">{f.name}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </ConfigSection>
  );
}

// ── Transform 配置 ────────────────────────────────────────────────────────────

function Vec3Input({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: Vec3;
  step?: number;
  onChange: (v: Vec3) => void;
}) {
  const axes = ['X', 'Y', 'Z'] as const;
  return (
    <div className="space-y-1.5">
      <label className="px-1 text-xs font-black uppercase tracking-widest text-slate-800">{label}</label>
      <div className="grid grid-cols-3 gap-3">
        {axes.map((axis, i) => (
          <div key={axis} className="relative group">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs font-black text-slate-500 group-focus-within:text-indigo-700 transition-colors">
              {axis}
            </span>
            <input
              type="number"
              step={step ?? 0.1}
              value={value[i]}
              onChange={(e) => {
                const next: Vec3 = [...value] as Vec3;
                next[i] = Number(e.target.value);
                onChange(next);
              }}
              className="w-full rounded-xl border-2 border-slate-300 bg-white pl-8 pr-2 py-2 text-sm font-black tabular-nums text-slate-900 outline-none transition-all focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 hover:border-slate-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TransformConfig({
  transform,
  onChange,
}: {
  transform: Transform3D;
  onChange: (t: Transform3D) => void;
}) {
  return (
    <ConfigSection label="4. 三维空间变换">
      <div className="space-y-6 rounded-xl border-2 border-slate-300 bg-slate-50 p-5 shadow-sm">
        <Vec3Input
          label="世界坐标 (Position)"
          value={transform.position}
          onChange={(position) => onChange({ ...transform, position })}
        />
        <Vec3Input
          label="旋转角度 (Rotation °)"
          value={transform.rotation}
          step={1}
          onChange={(rotation) => onChange({ ...transform, rotation })}
        />
        <Vec3Input
          label="物体缩放 (Scale)"
          value={transform.scale}
          onChange={(scale) => onChange({ ...transform, scale })}
        />
        <button
          onClick={() => onChange({ position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] })}
          className="mt-2 w-full rounded-xl border-2 border-slate-400 bg-white py-3 text-xs font-black uppercase tracking-widest text-slate-900 shadow-sm transition-all hover:border-slate-900 hover:bg-slate-50 active:scale-95"
        >
          恢复默认变换
        </button>
      </div>
    </ConfigSection>
  );
}


