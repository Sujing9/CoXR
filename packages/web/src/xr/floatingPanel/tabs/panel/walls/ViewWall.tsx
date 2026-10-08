import { useDoc } from '@/data/DocContext';
import { getNextViewName } from '@/lib/autoName';
import type { ViewId } from '@coxr/shared';
import { uuid } from '@coxr/shared';
import { Label } from '../../space/primitives';
import { useXRPanelNavStore } from '../xrPanelNavStore';
import { WallCard } from './WallCard';
import { GridLayout } from './GridLayout';
import { LIST_TITLE_FONT_SIZE, LIST_SUBTITLE_FONT_SIZE } from './wallConstants';

interface ViewWallProps {
  width: number;
  topY: number;
  bottomY: number;
}

const LIST_BADGE_FONT_SIZE = 0.022;

/**
 * L1-B：视图卡片墙。
 *
 * 第一张卡用于新建视图；后续卡片显示 视图名 + 数据源名 + 记录数。
 * 点击进入 L2-B `view` 详情。
 */
export function ViewWall({ width, topY, bottomY }: ViewWallProps) {
  const { doc, upsertView } = useDoc();
  const push = useXRPanelNavStore((s) => s.push);

  if (!doc) return null;

  const recordTypes = Object.values(doc.recordTypes);
  const views = Object.values(doc.views);

  const handleAddView = () => {
    const firstType = recordTypes[0];
    if (!firstType) return;

    const id = uuid() as unknown as ViewId;
    upsertView({
      id,
      name: getNextViewName(views.map((view) => view.name)),
      kind: 'table',
      recordTypeId: firstType.id,
      filter: [],
      sort: [],
      group: null,
      fieldVisibility: {},
      fieldOrder: [...firstType.fieldOrder],
    });
    push({ kind: 'view', id });
  };

  if (recordTypes.length === 0) {
    return (
      <Label
        x={0}
        y={(topY + bottomY) / 2}
        text="请先创建数据源"
        fontSize={0.024}
        color="rgba(0,0,0,0.65)"
      />
    );
  }

  return (
    <GridLayout
      width={width}
      topY={topY}
      bottomY={bottomY}
      columns={2}
      cardH={0.10}
      gap={0.012}
      itemCount={views.length + 1}
      renderItem={(i, x, y, cardW, cardH) => {
        if (i === 0) {
          return (
            <WallCard
              key="add-new-view"
              x={x}
              y={y}
              width={cardW}
              height={cardH}
              title="+ 新建视图"
              subtitle="基于首个数据源创建表格视图"
              accent="rgba(50,120,40,1)"
              titleFontSize={LIST_TITLE_FONT_SIZE}
              subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
              onPress={handleAddView}
            />
          );
        }

        const v = views[i - 1]!;
        const rt = doc.recordTypes[v.recordTypeId];
        const recordCount = Object.values(doc.records).filter(
          (r) => r.typeId === v.recordTypeId,
        ).length;
        return (
          <WallCard
            key={v.id}
            x={x}
            y={y}
            width={cardW}
            height={cardH}
            title={v.name}
            subtitle={`${rt?.name ?? '?'} · ${recordCount} 条`}
            accent="rgba(50,120,40,1)"
            titleFontSize={LIST_TITLE_FONT_SIZE}
            subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
            badgeFontSize={LIST_BADGE_FONT_SIZE}
            onPress={() => push({ kind: 'view', id: v.id as ViewId })}
          />
        );
      }}
    />
  );
}
