import { useDoc } from '@/data/DocContext';
import { Label } from '../../space/primitives';
import { useXRPanelNavStore } from '../xrPanelNavStore';
import { WallCard } from '../walls/WallCard';

interface PanelHubProps {
  width: number;
  height: number;
  /** 内容区顶部 y（已扣除 PanelHeader）。 */
  topY: number;
  /** 内容区底部 y（局部坐标）。 */
  bottomY: number;
}

/**
 * L0：三选一首屏。
 *
 * 三张大卡：场景元素 / 视图 / 数据源。
 * 用户点击进入对应 L1 卡片墙。
 */
export function PanelHub({ width, height: _height, topY, bottomY }: PanelHubProps) {
  const { doc } = useDoc();
  const push = useXRPanelNavStore((s) => s.push);

  if (!doc) {
    return <Label x={0} y={(topY + bottomY) / 2} text="文档加载中…" fontSize={0.024} color="rgba(0,0,0,0.85)" />;
  }

  const sceneItemCount = Object.keys(doc.scene.items).length;
  const viewCount = Object.keys(doc.views).length;
  const rtCount = Object.keys(doc.recordTypes).length;

  // 垂直三卡：等高 + gap
  const GAP = 0.014;
  const innerH = topY - bottomY;
  const cardH = (innerH - GAP * 2) / 3;
  const cardW = width - 0.012;

  const card1Y = topY - cardH / 2;
  const card2Y = card1Y - cardH - GAP;
  const card3Y = card2Y - cardH - GAP;

  return (
    <group>
      <WallCard
        y={card1Y}
        width={cardW}
        height={cardH}
        title="数据源"
        subtitle="只读浏览 · 字段定义"
        badge={rtCount}
        accent="rgba(150,100,50,1)"
        onPress={() => push({ kind: 'recordTypeWall' })}
      />
      <WallCard
        y={card2Y}
        width={cardW}
        height={cardH}
        title="视图"
        subtitle="创建/浏览 · 字段可见性"
        badge={viewCount}
        accent="rgba(50,120,40,1)"
        onPress={() => push({ kind: 'viewWall' })}
      />
      <WallCard
        y={card3Y}
        width={cardW}
        height={cardH}
        title="场景元素"
        subtitle="创建/配置 3D 图表"
        badge={sceneItemCount}
        accent="rgba(40,80,180,1)"
        onPress={() => push({ kind: 'sceneItemWall' })}
      />
    </group>
  );
}
