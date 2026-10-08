import { useDoc } from '@/data/DocContext';
import { Label } from '../space/primitives';
import { PanelHeader } from './PanelHeader';
import { useXRPanelNavStore } from './xrPanelNavStore';
import { PanelHub } from './hub/PanelHub';
import { SceneItemWall } from './walls/SceneItemWall';
import { ViewWall } from './walls/ViewWall';
import { RecordTypeWall } from './walls/RecordTypeWall';
import { SceneItemDetail } from './sceneItem/SceneItemDetail';
import { ViewDetail } from './view/ViewDetail';
import { RecordTypeDetail } from './recordType/RecordTypeDetail';

interface PanelTabProps {
  /** 内容区可用宽（米） */
  width: number;
  /** 内容区可用高（米） */
  height: number;
}

const HEADER_H = 0.044;
const HEADER_GAP = 0.008;

/**
 * XR 面板 tab 入口：单栏 + 栈式导航。
 *
 * 顶部 PanelHeader（路由感知，含返回按钮）+ 下方按当前 route 渲染对应页：
 *   L0 hub → L1 卡片墙 → L2 详情。
 *
 * 与 PC 的"双栏目录树 + 详情"模型不同：在 XR 中，
 *   - 选择由场景或卡片墙触发；
 *   - 数据源/视图/场景元素均可在墙页新建；
 *   - 详情页仍避免文本输入，主要提供选择/开关类编辑。
 */
export function PanelTab({ width, height }: PanelTabProps) {
  const { doc } = useDoc();
  const route = useXRPanelNavStore((s) => s.route);

  if (!doc) {
    return (
      <Label x={0} y={0} text="文档加载中…" fontSize={0.024} color="rgba(0,0,0,0.85)" />
    );
  }

  const headerCY = height / 2 - HEADER_H / 2;
  const contentTopY = height / 2 - HEADER_H - HEADER_GAP;
  const contentBottomY = -height / 2 + 0.006;

  return (
    <group>
      <PanelHeader width={width} centerY={headerCY} height={HEADER_H} />

      {route.kind === 'hub' && (
        <PanelHub
          width={width}
          height={height}
          topY={contentTopY}
          bottomY={contentBottomY}
        />
      )}

      {route.kind === 'sceneItemWall' && (
        <SceneItemWall width={width} topY={contentTopY} bottomY={contentBottomY} />
      )}

      {route.kind === 'viewWall' && (
        <ViewWall width={width} topY={contentTopY} bottomY={contentBottomY} />
      )}

      {route.kind === 'recordTypeWall' && (
        <RecordTypeWall width={width} topY={contentTopY} bottomY={contentBottomY} />
      )}

      {route.kind === 'sceneItem' && (
        <SceneItemDetail
          id={route.id}
          width={width}
          topY={contentTopY}
          bottomY={contentBottomY}
        />
      )}

      {route.kind === 'view' && (
        <ViewDetail
          id={route.id}
          width={width}
          topY={contentTopY}
          bottomY={contentBottomY}
        />
      )}

      {route.kind === 'recordType' && (
        <RecordTypeDetail
          id={route.id}
          width={width}
          topY={contentTopY}
          bottomY={contentBottomY}
        />
      )}
    </group>
  );
}
