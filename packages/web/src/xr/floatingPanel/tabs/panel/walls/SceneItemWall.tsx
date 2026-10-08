import { useDoc } from '@/data/DocContext';
import { getNextSceneItemName } from '@/lib/autoName';
import type { SceneItemId } from '@coxr/shared';
import { uuid } from '@coxr/shared';
import { Label } from '../../space/primitives';
import { useXRPanelNavStore } from '../xrPanelNavStore';
import { WallCard } from './WallCard';
import { GridLayout } from './GridLayout';
import { LIST_TITLE_FONT_SIZE, LIST_SUBTITLE_FONT_SIZE } from './wallConstants';

interface SceneItemWallProps {
  width: number;
  topY: number;
  bottomY: number;
}

const KIND_LABEL: Record<string, string> = {
  bar3d: '3D 柱状图',
  scatter3d: '3D 散点图',
  line3d: '3D 折线图',
  label: '标签',
};

const KIND_ACCENT: Record<string, string> = {
  bar3d: 'rgba(40,80,180,1)',
  scatter3d: 'rgba(100,60,140,1)',
  line3d: 'rgba(40,120,80,1)',
  label: 'rgba(140,120,20,1)',
};

/**
 * L1-A：场景元素卡片墙。
 *
 * 第一张卡用于新建场景元素；后续卡片显示 图表名 + 类型 + 来源视图名。
 * 点击进入 L2-A `sceneItem` 详情。
 */
export function SceneItemWall({ width, topY, bottomY }: SceneItemWallProps) {
  const { doc, upsertSceneItem } = useDoc();
  const push = useXRPanelNavStore((s) => s.push);

  if (!doc) return null;

  const items = Object.values(doc.scene.items);
  const views = Object.values(doc.views);

  const handleAddSceneItem = () => {
    const firstView = views[0];
    if (!firstView) return;

    const id = uuid() as unknown as SceneItemId;
    upsertSceneItem({
      id,
      kind: 'bar3d',
      name: getNextSceneItemName(items.map((item) => ('name' in item ? item.name ?? '' : ''))),
      sourceViewId: firstView.id,
      xField: null,
      yField: null,
      zField: null,
      transform3d: { position: [0, 0.3, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    });
    push({ kind: 'sceneItem', id });
  };

  if (views.length === 0) {
    return (
      <Label
        x={0}
        y={(topY + bottomY) / 2}
        text="请先创建视图"
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
      itemCount={items.length + 1}
      renderItem={(i, x, y, cardW, cardH) => {
        if (i === 0) {
          return (
            <WallCard
              key="add-new-scene-item"
              x={x}
              y={y}
              width={cardW}
              height={cardH}
              title="+ 新建场景元素"
              subtitle="创建一个新的 3D 图表"
              accent="rgba(40,80,180,1)"
              titleFontSize={LIST_TITLE_FONT_SIZE}
              subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
              onPress={handleAddSceneItem}
            />
          );
        }

        const it = items[i - 1]!;
        const name = ('name' in it && it.name) || KIND_LABEL[it.kind] || '场景元素';
        const sourceViewName =
          'sourceViewId' in it && doc.views[it.sourceViewId as string]
            ? doc.views[it.sourceViewId as string]!.name
            : null;
        const subtitle = sourceViewName
          ? `${KIND_LABEL[it.kind] ?? it.kind} · ${sourceViewName}`
          : KIND_LABEL[it.kind] ?? it.kind;
        return (
          <WallCard
            key={it.id}
            x={x}
            y={y}
            width={cardW}
            height={cardH}
            title={name}
            subtitle={subtitle}
            accent={KIND_ACCENT[it.kind] ?? 'rgba(0,0,0,0.35)'}
            titleFontSize={LIST_TITLE_FONT_SIZE}
            subtitleFontSize={LIST_SUBTITLE_FONT_SIZE}
            onPress={() => push({ kind: 'sceneItem', id: it.id as SceneItemId })}
          />
        );
      }}
    />
  );
}
