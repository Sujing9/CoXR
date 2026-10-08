import { useDoc } from '@/data/DocContext';
import { Btn, Label, Plate } from '../space/primitives';
import { useXRPanelNavStore } from './xrPanelNavStore';

interface PanelHeaderProps {
  width: number;
  /** 顶部行的中心 y（局部坐标）。 */
  centerY: number;
  /** 行高。 */
  height: number;
}

/**
 * 路由感知的顶部标题行：
 * - L0 hub：仅显示"面板"标题，无返回按钮。
 * - L1/L2：左侧返回箭头 + 当前页标题。
 *
 * 返回逻辑统一走 `nav.back()`（pop history），保证多级返回直觉。
 */
export function PanelHeader({ width, centerY, height }: PanelHeaderProps) {
  const route = useXRPanelNavStore((s) => s.route);
  const back = useXRPanelNavStore((s) => s.back);
  const { doc } = useDoc();

  const showBack = route.kind !== 'hub';

  const title = (() => {
    switch (route.kind) {
      case 'hub':
        return '面板';
      case 'sceneItemWall':
        return '场景元素';
      case 'sceneItem': {
        const item = doc?.scene.items[route.id];
        if (!item) return '场景元素';
        if (item.kind === 'label') return '标签';
        return ('name' in item && item.name) || '(未命名)';
      }
      case 'viewWall':
        return '视图';
      case 'view':
        return doc?.views[route.id]?.name ?? '视图';
      case 'recordTypeWall':
        return '数据源';
      case 'recordType':
        return doc?.recordTypes[route.id]?.name ?? '数据源';
    }
  })();

  const sub = (() => {
    switch (route.kind) {
      case 'hub':
        return null;
      case 'sceneItemWall':
        return '选择一个图表查看详情';
      case 'viewWall':
        return '只读浏览（编辑请在 PC 端）';
      case 'recordTypeWall':
        return '只读浏览（编辑请在 PC 端）';
      case 'sceneItem':
        return '可编辑：类型 / 数据视图 / 字段映射';
      case 'view':
        return '可编辑：字段可见性';
      case 'recordType':
        return '只读：字段定义';
    }
  })();

  const BACK_BTN_W = 0.058;
  const titleLX = showBack
    ? -width / 2 + BACK_BTN_W + 0.014
    : -width / 2 + 0.006;

  return (
    <group position={[0, centerY, 0]}>
      {/* 底色分隔条 */}
      <Plate
        x={0}
        y={-height / 2 - 0.0005}
        width={width}
        height={0.001}
        radius={0}
        color="rgba(0,0,0,0.15)"
      />
      {showBack && (
        <Btn
          x={-width / 2 + BACK_BTN_W / 2 + 0.004}
          width={BACK_BTN_W}
          height={0.034}
          radius={0.008}
          variant="ghost"
          label="‹ 返回"
          fontSize={0.016}
          onPress={back}
        />
      )}
      <Label
        x={titleLX}
        y={sub ? 0.006 : 0}
        text={title}
        fontSize={0.024}
        color="#000"
        anchorX="left"
        maxWidth={width / 2 + Math.abs(titleLX) - 0.010}
      />
      {sub && (
        <Label
          x={titleLX}
          y={-0.012}
          text={sub}
          fontSize={0.014}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
          maxWidth={width / 2 + Math.abs(titleLX) - 0.010}
        />
      )}
    </group>
  );
}

