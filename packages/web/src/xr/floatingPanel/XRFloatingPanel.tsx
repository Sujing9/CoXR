import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';
import { Container } from '@react-three/uikit';
import { Quaternion, Vector3 } from 'three';
import { DEFAULT_LOCAL_OFFSET, useXRPanelStore } from '../xrPanelStore';
import { useXRPanelUIStore } from '../xrPanelUIStore';
import { usePanelTransform } from './usePanelTransform';
import { HomeSphere } from './HomeSphere';
import { HomeSphereMenu } from './HomeSphereMenu';
import { CornerHandle } from './CornerHandle';
import { SystemMenu } from './SystemMenu';
import { TabContent } from './TabContent';
import { useSyncSceneFocusToXRPanel } from './tabs/panel/useSyncSceneFocusToXRPanel';
import {
  CARD_BG,
  CARD_BORDER,
  PANEL_FRAME_BG,
  PANEL_FRAME_BORDER,
  PANEL_FRAME_PADDING_PX,
  PANEL_FRAME_GAP_PX,
  LEFT_CARD_PADDING_PX,
  LEFT_CARD_RADIUS_PX,
  RIGHT_COLUMN_PX,
} from './systemPanelTheme';

const PIXEL = 0.002; // 1 uikit-px = 2mm

/**
 * XR 模式下的浮动面板。
 *
 * - 位置：相机世界位置 + worldOffset（世界向量 → 转头不变，走动跟随）
 * - 朝向：永远 lookAt 相机
 * - 始终可见：当前不提供折叠/隐藏功能
 *
 * 业务内容：本期空容器（暴露 children slot）。
 */
export function XRFloatingPanel({ children }: { children?: React.ReactNode }) {
  const groupRef = usePanelTransform();
  const { camera } = useThree();
  const inXRSession = useXR((s) => s.session != null);

  const width = useXRPanelStore((s) => s.width);
  const height = useXRPanelStore((s) => s.height);
  const initialized = useXRPanelUIStore((s) => s.initialized);

  // 场景里点选 SceneItem → 面板跳到 L2-A 详情（仅在 XR session 中触发）
  useSyncSceneFocusToXRPanel();

  // 进入 XR 第一帧把默认局部偏移（相机正前方 0.8m）按当前相机朝向投影到世界向量。
  // 注：必须用 useFrame 而非 window.requestAnimationFrame —— XR session 走的是 XRSession.RAF。
  const tmpV = useRef(new Vector3()).current;
  const tmpQ = useRef(new Quaternion()).current;
  useFrame(() => {
    if (!inXRSession) return;
    if (useXRPanelUIStore.getState().initialized) return;

    camera.getWorldPosition(tmpV);
    camera.getWorldQuaternion(tmpQ);
    const localOff = new Vector3(
      DEFAULT_LOCAL_OFFSET.x,
      DEFAULT_LOCAL_OFFSET.y,
      DEFAULT_LOCAL_OFFSET.z,
    ).applyQuaternion(tmpQ);
    useXRPanelStore.getState().setWorldOffset({
      x: localOff.x,
      y: localOff.y,
      z: localOff.z,
    });
    useXRPanelUIStore.getState().setInitialized(true);
  });

  const menuLocalY = -height / 2 - 0.07;

  // 内容卡片中心 X（面板局部）：左半区中心，避开右栏菜单。
  const { contentCenterX, contentWidth, contentHeight } = useMemo(() => {
    const padM = PANEL_FRAME_PADDING_PX * PIXEL;
    const gapM = PANEL_FRAME_GAP_PX * PIXEL;
    const colM = RIGHT_COLUMN_PX * PIXEL;
    const leftCardPadM = LEFT_CARD_PADDING_PX * PIXEL;
    const leftCardW = width - padM * 2 - gapM - colM;
    const cx = -width / 2 + padM + leftCardW / 2;
    return {
      contentCenterX: cx,
      contentWidth: leftCardW - leftCardPadM * 2,
      contentHeight: height - padM * 2 - leftCardPadM * 2,
    };
  }, [width, height]);

  return (
    <group ref={groupRef} visible={initialized}>
      {/* PanelFrame 外框：完全对齐 archived */}
      <Container
        sizeX={width}
        sizeY={height}
        pixelSize={PIXEL}
        borderRadius={18}
        backgroundColor={PANEL_FRAME_BG}
        borderWidth={1}
        borderColor={PANEL_FRAME_BORDER}
        flexDirection="row"
        padding={PANEL_FRAME_PADDING_PX}
        gap={PANEL_FRAME_GAP_PX}
        alignItems="stretch"
      >
        {/* 左：内容卡片（透明区域，3D 内容由 TabContent 在面板坐标下渲染） */}
        <Container
          flexGrow={1}
          backgroundColor={CARD_BG}
          borderWidth={1}
          borderColor={CARD_BORDER}
          borderRadius={LEFT_CARD_RADIUS_PX}
          padding={LEFT_CARD_PADDING_PX}
          flexDirection="column"
        />
        {/* 右：菜单栏 */}
        <SystemMenu />
      </Container>

      {/* 内容（drei Text 占位 → 后续替换成各 tab 实际组件） */}
      <TabContent centerX={contentCenterX} contentWidth={contentWidth} contentHeight={contentHeight} />

      {/* 业务内容 slot（保留外部传入扩展） */}
      <group position={[0, 0, 0.0005]}>{children}</group>

      {/* 角手柄：调整大小（右下） / 整体缩放（左下），由 UI 模式 toggle 控制显隐 */}
      <CornerHandle kind="resize" width={width} height={height} panelGroupRef={groupRef} />
      <CornerHandle kind="scale" width={width} height={height} panelGroupRef={groupRef} />

      {/* 小球（拖拽 / 点击展开菜单） */}
      <HomeSphere width={width} height={height} panelGroupRef={groupRef} />

      {/* 工具菜单（针对小球的） */}
      <HomeSphereMenu localY={menuLocalY} />
    </group>
  );
}
