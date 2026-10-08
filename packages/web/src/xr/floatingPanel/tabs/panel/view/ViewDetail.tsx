import { useDoc } from '@/data/DocContext';
import type { FieldDef, FieldId, FieldType, ViewId } from '@coxr/shared';
import { Btn, Label, Plate } from '../../space/primitives';
import { RayCheckbox } from '../primitives/RayCheckbox';
import { useXRPanelNavStore } from '../xrPanelNavStore';

interface ViewDetailProps {
  id: ViewId;
  width: number;
  topY: number;
  bottomY: number;
}

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: '文本',
  longText: '长文本',
  number: '数字',
  boolean: '勾选',
  select: '单选',
  multiSelect: '多选',
  date: '日期',
  url: '链接',
};

const ROW_H = 0.038;
const ROW_GAP = 0.004;

/**
 * L2-B：视图详情。
 *
 * 本期能力：
 * - 只读元信息（数据源、kind、记录数）
 * - 字段可见性 checkbox（写入 view.fieldVisibility）
 * - 删除（级联删除引用该视图的场景元素）
 *
 * 不做：filter / sort / fieldOrder / 表格预览。
 */
export function ViewDetail({ id, width, topY, bottomY }: ViewDetailProps) {
  const { doc, upsertView, removeView, removeSceneItem } = useDoc();
  const back = useXRPanelNavStore((s) => s.back);

  if (!doc) return null;
  const view = doc.views[id];
  if (!view) return null;
  const rt = doc.recordTypes[view.recordTypeId];

  const recordCount = Object.values(doc.records).filter(
    (r) => r.typeId === view.recordTypeId,
  ).length;

  const fields: FieldDef[] = rt
    ? [
        ...view.fieldOrder,
        ...rt.fieldOrder.filter((fid) => !view.fieldOrder.includes(fid)),
      ]
        .map((fid) => rt.fields[fid])
        .filter((f): f is FieldDef => Boolean(f))
    : [];

  const handleToggle = (fieldId: FieldId, nextVisible: boolean) => {
    upsertView({
      ...view,
      fieldVisibility: {
        ...view.fieldVisibility,
        [fieldId]: nextVisible,
      },
    });
  };

  const handleDelete = () => {
    Object.values(doc.scene.items)
      .filter((item) => 'sourceViewId' in item && item.sourceViewId === id)
      .forEach((item) => removeSceneItem(item.id));
    removeView(id);
    back();
  };

  // ── Layout ─────────────────────────────────────────────────────────────────

  const innerW = width - 0.020;
  const META_H = 0.044;
  const SECTION_TITLE_H = 0.020;
  const DEL_BTN_W = 0.078;

  const metaCY = topY - META_H / 2;
  const sectionTitleY = metaCY - META_H / 2 - 0.006 - SECTION_TITLE_H / 2;
  const listTop = sectionTitleY - SECTION_TITLE_H / 2 - 0.004;
  const listBottom = bottomY;
  const listH = listTop - listBottom;
  const maxRows = Math.max(1, Math.floor((listH + ROW_GAP) / (ROW_H + ROW_GAP)));
  const overflow = fields.length > maxRows;
  const visible = overflow ? fields.slice(0, maxRows - 1) : fields;
  const remaining = overflow ? fields.length - visible.length : 0;

  return (
    <group>
      {/* 元信息 */}
      <group position={[0, metaCY, 0]}>
        <Plate
          width={innerW}
          height={META_H}
          radius={0.010}
          color="rgba(0,0,0,0.10)"
        />
        <Label
          x={-innerW / 2 + 0.012}
          y={0.008}
          text={`数据源：${rt?.name ?? '?'}`}
          fontSize={0.016}
          color="#000"
          anchorX="left"
          maxWidth={innerW - 0.024}
        />
        <Label
          x={-innerW / 2 + 0.012}
          y={-0.010}
          text={`视图类型：${view.kind} · ${recordCount} 条记录 · ${fields.length} 个字段`}
          fontSize={0.013}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
          maxWidth={innerW - DEL_BTN_W - 0.036}
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

      {/* 字段可见性区标题 */}
      <Label
        x={-innerW / 2 + 0.004}
        y={sectionTitleY}
        text="字段可见性"
        fontSize={0.016}
        color="rgba(0,0,0,0.85)"
        anchorX="left"
      />

      {/* 字段列表 */}
      {fields.length === 0 && (
        <Label
          x={0}
          y={(listTop + listBottom) / 2}
          text="该数据源暂无字段"
          fontSize={0.016}
          color="rgba(0,0,0,0.50)"
        />
      )}
      {visible.map((f, i) => {
        const cy = listTop - ROW_H / 2 - i * (ROW_H + ROW_GAP);
        const checked = view.fieldVisibility[f.id] !== false;
        return (
          <RayCheckbox
            key={f.id}
            x={0}
            y={cy}
            width={innerW}
            height={ROW_H}
            checked={checked}
            label={f.name}
            subtitle={FIELD_TYPE_LABEL[f.type]}
            onChange={(next) => handleToggle(f.id as FieldId, next)}
          />
        );
      })}
      {overflow && (
        <Label
          x={0}
          y={listTop - visible.length * (ROW_H + ROW_GAP) - 0.004}
          text={`还有 ${remaining} 个字段 · 请在 PC 端查看`}
          fontSize={0.014}
          color="rgba(0,0,0,0.65)"
        />
      )}
    </group>
  );
}
