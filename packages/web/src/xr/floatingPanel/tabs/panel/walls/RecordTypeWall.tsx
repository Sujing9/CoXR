import { useDoc } from '@/data/DocContext';
import { getNextRecordTypeName } from '@/lib/autoName';
import type { RecordTypeId, FieldId } from '@coxr/shared';
import { uuid } from '@coxr/shared';
import { useXRPanelNavStore } from '../xrPanelNavStore';
import { WallCard } from './WallCard';
import { GridLayout } from './GridLayout';
import { LIST_TITLE_FONT_SIZE, LIST_SUBTITLE_FONT_SIZE } from './wallConstants';

interface RecordTypeWallProps {
  width: number;
  topY: number;
  bottomY: number;
}

const LIST_BADGE_FONT_SIZE = 0.022;

/**
 * L1-C：数据源卡片墙。
 *
 * 第一张卡固定为“新建数据源”。
 * 后面每张卡显示 数据源名 + 字段数 + 记录数。
 * 点击进入 L2-C `recordType` 详情。
 */
export function RecordTypeWall({ width, topY, bottomY }: RecordTypeWallProps) {
  const { doc, upsertRecordType } = useDoc();
  const push = useXRPanelNavStore((s) => s.push);

  if (!doc) return null;

  const rts = Object.values(doc.recordTypes);

  // 同步 PC 端的创建逻辑
  const handleAddRecordType = () => {
    const newName = getNextRecordTypeName(rts.map((rt) => rt.name));

    const id = uuid() as unknown as RecordTypeId;
    const primaryFieldId = uuid() as unknown as FieldId;
    
    upsertRecordType({
      id,
      name: newName,
      primaryFieldId,
      fields: {
        [primaryFieldId]: { id: primaryFieldId, name: '标题', type: 'text' },
      },
      fieldOrder: [primaryFieldId],
    });
    
    // 创建后直接进入该新建数据源详情页面
    push({ kind: 'recordType', id });
  };

  return (
    <GridLayout
      width={width}
      topY={topY}
      bottomY={bottomY}
      columns={2}
      cardH={0.10}
      gap={0.012}
      itemCount={rts.length + 1}
      renderItem={(i, x, y, cardW, cardH) => {
        // 第一项分配给 "新建数据源" 卡片
        if (i === 0) {
          return (
            <WallCard
              key="add-new-record-type"
              x={x}
              y={y}
              width={cardW}
              height={cardH}
              title="+ 新建数据源"
              subtitle="创建并配置新的数据结构"
              accent="rgba(40,120,60,1)"
              titleFontSize={LIST_TITLE_FONT_SIZE}
              subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
              onPress={handleAddRecordType}
            />
          );
        }

        // 渲染后续存在的数据源内容
        const rt = rts[i - 1]!;
        const fieldCount = rt.fieldOrder.length;
        const recordCount = Object.values(doc.records).filter(
          (r) => r.typeId === rt.id,
        ).length;
        
        return (
          <WallCard
            key={rt.id}
            x={x}
            y={y}
            width={cardW}
            height={cardH}
            title={rt.name}
            subtitle={`${fieldCount} 字段 · ${recordCount} 条记录`}
            accent="rgba(150,100,50,1)"
            titleFontSize={LIST_TITLE_FONT_SIZE}
            subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
            badgeFontSize={LIST_BADGE_FONT_SIZE}
            onPress={() => push({ kind: 'recordType', id: rt.id as RecordTypeId })}
          />
        );
      }}
    />
  );
}
