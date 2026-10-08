import { useDoc } from '@/data/DocContext';
import type { FieldDef, FieldType, RecordTypeId } from '@coxr/shared';
import { Btn, Label, Plate } from '../../space/primitives';
import { useXRPanelNavStore } from '../xrPanelNavStore';

interface RecordTypeDetailProps {
  id: RecordTypeId;
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

const FIELD_TYPE_COLOR: Record<FieldType, string> = {
  text: 'rgba(70,90,120,1)',
  longText: 'rgba(70,90,120,1)',
  number: 'rgba(30,100,170,1)',
  boolean: 'rgba(20,130,40,1)',
  select: 'rgba(130,70,150,1)',
  multiSelect: 'rgba(150,90,30,1)',
  date: 'rgba(140,120,20,1)',
  url: 'rgba(20,120,140,1)',
};

const ROW_H = 0.034;
const ROW_GAP = 0.005;

/**
 * L2-C：数据源详情。
 *
 * 可删除；字段定义仍保持只读。
 * 不做：增删字段、改名、记录浏览（下一阶段在场景里展厅化呈现）。
 */
export function RecordTypeDetail({ id, width, topY, bottomY }: RecordTypeDetailProps) {
  const { doc, removeRecordType, removeView, removeSceneItem } = useDoc();
  const back = useXRPanelNavStore((s) => s.back);

  if (!doc) return null;
  const rt = doc.recordTypes[id];
  if (!rt) return null;

  const fields: FieldDef[] = rt.fieldOrder
    .map((fid) => rt.fields[fid])
    .filter((f): f is FieldDef => Boolean(f));

  const recordCount = Object.values(doc.records).filter(
    (r) => r.typeId === id,
  ).length;

  // 数据源在视图/场景里的引用计数
  const referencingViews = Object.values(doc.views).filter(
    (v) => v.recordTypeId === id,
  );
  const viewIds = new Set<string>(referencingViews.map((v) => v.id));
  const referencingSceneItems = Object.values(doc.scene.items).filter(
    (s) => 'sourceViewId' in s && viewIds.has(s.sourceViewId as unknown as string),
  );

  const handleDelete = () => {
    referencingSceneItems.forEach((item) => removeSceneItem(item.id));
    referencingViews.forEach((view) => removeView(view.id));
    removeRecordType(id);
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
          text={`${fields.length} 个字段 · ${recordCount} 条记录`}
          fontSize={0.016}
          color="#000"
          anchorX="left"
          maxWidth={innerW - 0.024}
        />
        <Label
          x={-innerW / 2 + 0.012}
          y={-0.010}
          text={`被 ${referencingViews.length} 个视图、${referencingSceneItems.length} 个场景元素引用`}
          fontSize={0.013}
          color="rgba(0,0,0,0.70)"
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

      {/* Section title */}
      <Label
        x={-innerW / 2 + 0.004}
        y={sectionTitleY}
        text="字段定义（只读）"
        fontSize={0.016}
        color="rgba(0,0,0,0.80)"
        anchorX="left"
      />

      {/* 字段列表 */}
      {fields.length === 0 && (
        <Label
          x={0}
          y={(listTop + listBottom) / 2}
          text="暂无字段"
          fontSize={0.016}
          color="rgba(0,0,0,0.50)"
        />
      )}
      {visible.map((f, i) => {
        const cy = listTop - ROW_H / 2 - i * (ROW_H + ROW_GAP);
        const isPrimary = f.id === rt.primaryFieldId;
        return (
          <FieldRow
            key={f.id}
            y={cy}
            width={innerW}
            field={f}
            isPrimary={isPrimary}
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

// ─── FieldRow ──────────────────────────────────────────────────────────────────

function FieldRow({
  y,
  width,
  field,
  isPrimary,
}: {
  y: number;
  width: number;
  field: FieldDef;
  isPrimary: boolean;
}) {
  const TYPE_BADGE_W = 0.054;
  const PRIMARY_BADGE_W = 0.026;
  const innerLX = -width / 2 + 0.012;
  const rightAnchor = width / 2 - 0.010;
  const typeBadgeCX = rightAnchor - TYPE_BADGE_W / 2;
  const primaryBadgeCX = isPrimary
    ? typeBadgeCX - TYPE_BADGE_W / 2 - 0.006 - PRIMARY_BADGE_W / 2
    : 0;
  const nameRX = isPrimary
    ? primaryBadgeCX - PRIMARY_BADGE_W / 2 - 0.008
    : typeBadgeCX - TYPE_BADGE_W / 2 - 0.008;
  const nameMaxW = nameRX - innerLX;

  const optionsCount =
    (field.type === 'select' || field.type === 'multiSelect') &&
    Array.isArray(field.options)
      ? field.options.length
      : 0;

  return (
    <group position={[0, y, 0]}>
      <Plate width={width} height={ROW_H} radius={0.008} color="rgba(0,0,0,0.12)" />
      <Label
        x={innerLX}
        y={optionsCount > 0 ? 0.005 : 0}
        text={field.name}
        fontSize={0.016}
        color="#000"
        anchorX="left"
        maxWidth={nameMaxW}
      />
      {optionsCount > 0 && (
        <Label
          x={innerLX}
          y={-0.010}
          text={`${optionsCount} 个选项`}
          fontSize={0.013}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
        />
      )}
      {isPrimary && (
        <group position={[primaryBadgeCX, 0, 0]}>
          <Plate
            width={PRIMARY_BADGE_W}
            height={0.018}
            radius={0.004}
            color="rgba(140,120,20,1)"
          />
          <Label text="主" fontSize={0.013} color="#fff" outline={false} />
        </group>
      )}
      <group position={[typeBadgeCX, 0, 0]}>
        <Plate
          width={TYPE_BADGE_W}
          height={0.018}
          radius={0.004}
          color={FIELD_TYPE_COLOR[field.type]}
        />
        <Label text={FIELD_TYPE_LABEL[field.type]} fontSize={0.013} color="#fff" outline={false} />
      </group>
    </group>
  );
}
