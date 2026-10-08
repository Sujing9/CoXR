import { useDoc } from '@/data/DocContext';
import type {
  Bar3DItem,
  FieldDef,
  FieldId,
  Line3DItem,
  Scatter3DItem,
  SceneItem,
  SceneItemId,
  SerializedDoc,
  Transform3D,
  ViewId,
} from '@coxr/shared';
import { Btn, Label, Plate } from '../../space/primitives';
import { useXRPanelNavStore } from '../xrPanelNavStore';

interface SceneItemDetailProps {
  id: SceneItemId;
  width: number;
  topY: number;
  bottomY: number;
}

type ChartKind = 'bar3d' | 'scatter3d' | 'line3d';

const KIND_LABEL: Record<ChartKind, string> = {
  bar3d: '3D 柱状图',
  scatter3d: '3D 散点图',
  line3d: '3D 折线图',
};

const SECTION_TITLE_H = 0.018;
const SECTION_GAP = 0.012;
const SEG_ROW_H = 0.030;
const FIELD_ROW_H = 0.030;
const FIELD_ROW_GAP = 0.005;

/**
 * L2-A：场景元素详情（本期唯一可编辑页）。
 *
 * 可编辑：
 * - 元素类型（柱/散点/折线）
 * - 数据视图
 * - 字段映射（X/Y/Z/Color/Size，因元素类型而异）
 * - 删除（直接执行）
 *
 * 不做：
 * - 改名（XR 暂不引入文本输入）
 * - 改 transform3d（在场景里直接抓取）
 * - label 元素配置
 */
export function SceneItemDetail({
  id,
  width,
  topY,
  bottomY,
}: SceneItemDetailProps) {
  const { doc, upsertSceneItem, removeSceneItem } = useDoc();
  const back = useXRPanelNavStore((s) => s.back);

  if (!doc) return null;
  const item = doc.scene.items[id];
  if (!item) return null;

  const innerW = width - 0.020;

  if (item.kind === 'label') {
    return (
      <Label
        x={0}
        y={(topY + bottomY) / 2}
        text="标签元素暂不支持在 XR 中配置"
        fontSize={0.018}
        color="rgba(0,0,0,0.85)"
        maxWidth={innerW}
      />
    );
  }

  const chart = item as Bar3DItem | Scatter3DItem | Line3DItem;

  // ── handlers ───────────────────────────────────────────────────────────────

  const handleKindChange = (k: ChartKind) => {
    if (chart.kind === k) return;
    const sourceViewId = chart.sourceViewId ?? (Object.keys(doc.views)[0] as ViewId);
    const transform3d = chart.transform3d as Transform3D;
    const name = chart.name ?? '新图表';
    if (k === 'bar3d') {
      upsertSceneItem({ id, kind: 'bar3d', name, sourceViewId, xField: null, yField: null, zField: null, transform3d });
    } else if (k === 'scatter3d') {
      upsertSceneItem({ id, kind: 'scatter3d', name, sourceViewId, xField: null, yField: null, zField: null, colorField: null, sizeField: null, transform3d });
    } else {
      upsertSceneItem({ id, kind: 'line3d', name, sourceViewId, xField: null, yField: null, colorField: null, transform3d });
    }
  };

  const handleViewChange = (vid: ViewId) => {
    if (chart.kind === 'bar3d') {
      upsertSceneItem({ ...chart, sourceViewId: vid, xField: null, yField: null, zField: null });
    } else if (chart.kind === 'scatter3d') {
      upsertSceneItem({ ...chart, sourceViewId: vid, xField: null, yField: null, zField: null, colorField: null, sizeField: null });
    } else {
      upsertSceneItem({ ...chart, sourceViewId: vid, xField: null, yField: null, colorField: null });
    }
  };

  const handleFieldChange = (key: string, value: FieldId | null) => {
    upsertSceneItem({ ...chart, [key]: value } as SceneItem);
  };

  const handleDelete = () => {
    removeSceneItem(id);
    back();
  };

  // ── 可用字段 ───────────────────────────────────────────────────────────────

  const view = doc.views[chart.sourceViewId];
  const type = view ? doc.recordTypes[view.recordTypeId] : undefined;
  const fields: FieldDef[] = type
    ? type.fieldOrder
        .map((fid) => type.fields[fid])
        .filter((f): f is FieldDef => Boolean(f))
    : [];

  const axes = getAxes(chart);

  // ── 布局 ───────────────────────────────────────────────────────────────────

  let yCursor = topY;

  // 元数据条（kind + 删除按钮）
  const metaRowH = 0.040;
  const metaCY = yCursor - metaRowH / 2;
  yCursor -= metaRowH + SECTION_GAP;

  // 元素类型
  const kindTitleY = yCursor - SECTION_TITLE_H / 2;
  yCursor -= SECTION_TITLE_H + 0.004;
  const kindRowCY = yCursor - SEG_ROW_H / 2;
  yCursor -= SEG_ROW_H + SECTION_GAP;

  // 数据视图
  const viewTitleY = yCursor - SECTION_TITLE_H / 2;
  yCursor -= SECTION_TITLE_H + 0.004;
  const viewRowCY = yCursor - SEG_ROW_H / 2;
  yCursor -= SEG_ROW_H + SECTION_GAP;

  // 字段映射
  const fmapTitleY = yCursor - SECTION_TITLE_H / 2;
  yCursor -= SECTION_TITLE_H + 0.004;
  const axisRowCYs: number[] = [];
  for (let i = 0; i < axes.length; i++) {
    const cy = yCursor - FIELD_ROW_H / 2;
    axisRowCYs.push(cy);
    yCursor -= FIELD_ROW_H + FIELD_ROW_GAP;
  }
  yCursor -= 0.004;

  // 提示
  const hintY = yCursor - 0.012;
  const overflow = hintY - 0.020 < bottomY;

  // ── render ────────────────────────────────────────────────────────────────

  const DEL_BTN_W = 0.078;

  return (
    <group>
      {/* 元数据条 */}
      <group position={[0, metaCY, 0]}>
        <Plate
          width={innerW}
          height={metaRowH}
          radius={0.010}
          color="rgba(0,0,0,0.10)"
        />
        <Label
          x={-innerW / 2 + 0.012}
          y={0.006}
          text={KIND_LABEL[chart.kind]}
          fontSize={0.016}
          color="#000"
          anchorX="left"
        />
        <Label
          x={-innerW / 2 + 0.012}
          y={-0.010}
          text={`#${id.slice(0, 6)} · 改名/位置请回 PC 端`}
          fontSize={0.013}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
        />
        <Btn
          x={innerW / 2 - DEL_BTN_W / 2 - 0.004}
          width={DEL_BTN_W}
          height={0.030}
          radius={0.008}
          label="删除"
          fontSize={0.014}
          variant="danger"
          onPress={handleDelete}
        />
      </group>

      {/* 元素类型 */}
      <Label
        x={-innerW / 2 + 0.004}
        y={kindTitleY}
        text="1. 元素类型"
        fontSize={0.016}
        color="rgba(0,0,0,0.85)"
        anchorX="left"
      />
      <SegmentRow
        y={kindRowCY}
        width={innerW}
        height={SEG_ROW_H}
        items={(['bar3d', 'scatter3d', 'line3d'] as ChartKind[]).map((k) => ({
          key: k,
          label: KIND_LABEL[k],
        }))}
        activeKey={chart.kind}
        onSelect={(k) => handleKindChange(k as ChartKind)}
      />

      {/* 数据视图 */}
      <Label
        x={-innerW / 2 + 0.004}
        y={viewTitleY}
        text="2. 数据视图"
        fontSize={0.016}
        color="rgba(0,0,0,0.85)"
        anchorX="left"
      />
      <ViewSelector
        y={viewRowCY}
        width={innerW}
        height={SEG_ROW_H}
        doc={doc}
        activeId={chart.sourceViewId}
        onSelect={handleViewChange}
      />

      {/* 字段映射 */}
      <Label
        x={-innerW / 2 + 0.004}
        y={fmapTitleY}
        text="3. 字段映射"
        fontSize={0.016}
        color="rgba(0,0,0,0.85)"
        anchorX="left"
      />
      {axes.length === 0 && (
        <Label
          x={0}
          y={fmapTitleY - 0.020}
          text="(此类型无字段映射)"
          fontSize={0.016}
          color="rgba(0,0,0,0.50)"
        />
      )}
      {axes.map((axis, i) => (
        <FieldMappingRow
          key={axis.key}
          y={axisRowCYs[i]!}
          width={innerW}
          height={FIELD_ROW_H}
          label={axis.label}
          fields={fields}
          activeId={(chart as unknown as Record<string, FieldId | null>)[axis.key] ?? null}
          onSelect={(fid) => handleFieldChange(axis.key, fid)}
        />
      ))}

      {/* 提示 */}
      {!overflow && (
        <Label
          x={0}
          y={hintY}
          text="提示：在场景中抓取此图表可调整位置 / 旋转 / 缩放"
          fontSize={0.013}
          color="rgba(0,0,0,0.60)"
        />
      )}
    </group>
  );
}

// ─── SegmentRow ──────────────────────────────────────────────────────────────

function SegmentRow({
  y,
  width,
  height,
  items,
  activeKey,
  onSelect,
}: {
  y: number;
  width: number;
  height: number;
  items: { key: string; label: string }[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const gap = 0.006;
  const segW = (width - gap * (items.length - 1)) / items.length;
  return (
    <group position={[0, y, 0]}>
      {items.map((it, i) => (
        <Btn
          key={it.key}
          x={-width / 2 + segW / 2 + i * (segW + gap)}
          width={segW}
          height={height}
          radius={0.008}
          label={it.label}
          fontSize={0.016}
          variant="segment"
          active={activeKey === it.key}
          onPress={() => onSelect(it.key)}
        />
      ))}
    </group>
  );
}

// ─── ViewSelector ────────────────────────────────────────────────────────────

function ViewSelector({
  y,
  width,
  height,
  doc,
  activeId,
  onSelect,
}: {
  y: number;
  width: number;
  height: number;
  doc: SerializedDoc;
  activeId: ViewId;
  onSelect: (id: ViewId) => void;
}) {
  const views = Object.values(doc.views);
  if (views.length === 0) {
    return (
      <Label
        x={0}
        y={y}
        text="(暂无可用视图，请先在 PC 端创建)"
        fontSize={0.016}
        color="rgba(0,0,0,0.50)"
      />
    );
  }
  // 最多 3 个 segment；超出第 4 个起合并为 "+N"
  const visible = views.slice(0, 3);
  const truncated = views.length - visible.length;
  const gap = 0.006;
  const segCount = visible.length + (truncated > 0 ? 1 : 0);
  const segW = (width - gap * (segCount - 1)) / segCount;

  return (
    <group position={[0, y, 0]}>
      {visible.map((v, i) => {
        const rtName = doc.recordTypes[v.recordTypeId]?.name ?? '';
        return (
          <Btn
            key={v.id}
            x={-width / 2 + segW / 2 + i * (segW + gap)}
            width={segW}
            height={height}
            radius={0.008}
            label={rtName ? `${v.name} · ${rtName}` : v.name}
            fontSize={0.014}
            variant="segment"
            active={activeId === v.id}
            onPress={() => onSelect(v.id as ViewId)}
          />
        );
      })}
      {truncated > 0 && (
        <Btn
          x={-width / 2 + segW / 2 + visible.length * (segW + gap)}
          width={segW}
          height={height}
          radius={0.008}
          label={`+${truncated}`}
          fontSize={0.014}
          variant="segment"
          disabled
        />
      )}
    </group>
  );
}

// ─── FieldMappingRow + FieldChips ────────────────────────────────────────────

function FieldMappingRow({
  y,
  width,
  height,
  label,
  fields,
  activeId,
  onSelect,
}: {
  y: number;
  width: number;
  height: number;
  label: string;
  fields: FieldDef[];
  activeId: FieldId | null;
  onSelect: (id: FieldId | null) => void;
}) {
  const labelW = 0.062;
  const labelLX = -width / 2 + 0.004;
  const optsX = -width / 2 + labelW;
  const optsW = width - labelW - 0.004;

  return (
    <group position={[0, y, 0]}>
      <Label
        x={labelLX}
        text={label}
        fontSize={0.014}
        color="rgba(0,0,0,0.85)"
        anchorX="left"
        maxWidth={labelW - 0.006}
      />
      <FieldChips
        startX={optsX}
        innerW={optsW}
        height={height}
        fields={fields}
        activeId={activeId}
        onSelect={onSelect}
      />
    </group>
  );
}

function FieldChips({
  startX,
  innerW,
  height,
  fields,
  activeId,
  onSelect,
}: {
  startX: number;
  innerW: number;
  height: number;
  fields: FieldDef[];
  activeId: FieldId | null;
  onSelect: (id: FieldId | null) => void;
}) {
  if (fields.length === 0) {
    return (
      <Label
        x={startX}
        text="(无可用字段)"
        fontSize={0.014}
        color="rgba(0,0,0,0.50)"
        anchorX="left"
      />
    );
  }

  const FONT = 0.014;
  const PAD = 0.006;
  const GAP = 0.004;

  const items: { key: string; label: string; id: FieldId | null }[] = [
    { key: '__none__', label: '无', id: null },
    ...fields.map((f) => ({ key: f.id, label: f.name, id: f.id as FieldId })),
  ];

  const sized = items.map((it) => ({
    ...it,
    w: Math.min(0.10, estimateTextWidth(it.label, FONT) + PAD * 2),
  }));

  let x = 0;
  const placed: Array<{ it: (typeof sized)[number]; cx: number }> = [];
  for (const it of sized) {
    if (x + it.w > innerW) break;
    placed.push({ it, cx: startX + x + it.w / 2 });
    x += it.w + GAP;
  }
  const truncated = sized.length - placed.length;

  return (
    <group>
      {placed.map(({ it, cx }) => {
        const active = it.id === activeId;
        return (
          <Btn
            key={it.key}
            x={cx}
            width={it.w}
            height={height - 0.004}
            radius={(height - 0.004) / 2}
            label={it.label}
            fontSize={FONT}
            variant="segment"
            active={active}
            onPress={() => onSelect(it.id)}
          />
        );
      })}
      {truncated > 0 && (
        <Label
          x={startX + x}
          text={`+${truncated}`}
          fontSize={FONT}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
        />
      )}
    </group>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAxes(item: Bar3DItem | Scatter3DItem | Line3DItem): {
  key: string;
  label: string;
}[] {
  if (item.kind === 'bar3d') {
    return [
      { key: 'xField', label: 'X 轴' },
      { key: 'yField', label: 'Y 轴' },
      { key: 'zField', label: 'Z 轴' },
    ];
  }
  if (item.kind === 'scatter3d') {
    return [
      { key: 'xField', label: 'X 轴' },
      { key: 'yField', label: 'Y 轴' },
      { key: 'zField', label: 'Z 轴' },
      { key: 'colorField', label: '颜色' },
      { key: 'sizeField', label: '大小' },
    ];
  }
  return [
    { key: 'xField', label: 'X 轴' },
    { key: 'yField', label: 'Y 轴' },
    { key: 'colorField', label: '颜色' },
  ];
}

function estimateTextWidth(text: string, fontSize: number): number {
  let w = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    w += code < 128 ? fontSize * 0.55 : fontSize;
  }
  return w;
}
