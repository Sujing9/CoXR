import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { type ThreeEvent, useThree } from '@react-three/fiber';
import {
  DoubleSide,
  Plane,
  Quaternion,
  RingGeometry,
  Vector3,
  type Group,
  type Ray,
} from 'three';
import { useXRPanelStore } from '../xrPanelStore';
import { useXRPanelUIStore } from '../xrPanelUIStore';

const HIT_SIZE = 0.1;
const RING_INNER = 0.04;
const RING_THICKNESS = 0.02;

interface CornerHandleProps {
  width: number;
  height: number;
  panelGroupRef: RefObject<Group | null>;
  /** 'resize' = 右下角调宽高；'scale' = 左下角整体缩放 */
  kind: 'resize' | 'scale';
}

function intersectRayWithPlane(ray: Ray, plane: Plane, out: Vector3): boolean {
  return ray.intersectPlane(plane, out) !== null;
}

/**
 * 1/4 环形角手柄。统一实现 Resize（右下）与 Scale（左下）。
 * 都基于"射线-面板平面求交"获取 ΔlocalXY。
 */
export function CornerHandle({ width, height, panelGroupRef, kind }: CornerHandleProps) {
  const gl = useThree((s) => s.gl);
  const active = useXRPanelUIStore((s) =>
    kind === 'resize' ? s.resizing : s.scaling,
  );

  const [hover, setHover] = useState(false);
  const draggingRef = useRef(false);

  const planeRef = useRef(new Plane());
  const startHitRef = useRef(new Vector3());
  const invQuatRef = useRef(new Quaternion());
  const startWidthRef = useRef(0);
  const startHeightRef = useRef(0);
  const startScaleRef = useRef(0);

  const tmp = useMemo(
    () => ({
      q: new Quaternion(),
      invQ: new Quaternion(),
      normal: new Vector3(),
      anchor: new Vector3(),
      hit: new Vector3(),
      deltaWorld: new Vector3(),
      deltaLocal: new Vector3(),
    }),
    [],
  );

  const ringGeometry = useMemo(() => {
    const outer = RING_INNER + RING_THICKNESS;
    const thetaStart = kind === 'resize' ? -Math.PI / 2 : Math.PI;
    return new RingGeometry(RING_INNER, outer, 32, 1, thetaStart, Math.PI / 2);
  }, [kind]);

  useEffect(() => () => { ringGeometry.dispose(); }, [ringGeometry]);

  // 角点本地坐标
  const cornerSign = kind === 'resize' ? 1 : -1; // x 方向
  const cornerLocal: [number, number, number] = useMemo(() => {
    return [(cornerSign * width) / 2, -height / 2, 0];
  }, [width, height, cornerSign]);

  // hit / ring 视觉的偏移（向角外）
  const OUTER_GAP = -0.015;
  const hitOffset: [number, number, number] = [
    cornerSign * (-OUTER_GAP - HIT_SIZE / 2),
    -OUTER_GAP - HIT_SIZE / 2,
    -0.001,
  ];
  const ringOffset: [number, number, number] = [cornerSign * -OUTER_GAP, -OUTER_GAP, 0];

  const beginDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const panelGroup = panelGroupRef.current;
    if (!panelGroup) return;

    draggingRef.current = true;
    const panel = useXRPanelStore.getState();
    startWidthRef.current = panel.width;
    startHeightRef.current = panel.height;
    startScaleRef.current = panel.scale;

    const targetEl = e.target as unknown as {
      setPointerCapture?: (id: number) => void;
      releasePointerCapture?: (id: number) => void;
    };
    if (targetEl?.setPointerCapture) targetEl.setPointerCapture(e.pointerId);
    else gl.domElement.setPointerCapture(e.pointerId);

    panelGroup.getWorldQuaternion(tmp.q);
    tmp.normal.set(0, 0, 1).applyQuaternion(tmp.q).normalize();
    panelGroup.localToWorld(tmp.anchor.set(...cornerLocal));
    planeRef.current.setFromNormalAndCoplanarPoint(tmp.normal, tmp.anchor);
    tmp.invQ.copy(tmp.q).invert();
    invQuatRef.current.copy(tmp.invQ);

    if (!intersectRayWithPlane(e.ray, planeRef.current, startHitRef.current)) {
      draggingRef.current = false;
      if (targetEl?.releasePointerCapture) targetEl.releasePointerCapture(e.pointerId);
      else gl.domElement.releasePointerCapture(e.pointerId);
    }
  };

  const updateDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    if (!intersectRayWithPlane(e.ray, planeRef.current, tmp.hit)) return;

    tmp.deltaWorld.copy(tmp.hit).sub(startHitRef.current);
    tmp.deltaLocal.copy(tmp.deltaWorld).applyQuaternion(invQuatRef.current);

    if (kind === 'resize') {
      const s = startScaleRef.current || 1;
      const nextWidth = startWidthRef.current + tmp.deltaLocal.x / s;
      const nextHeight = startHeightRef.current - tmp.deltaLocal.y / s;
      useXRPanelStore.getState().setSize({ width: nextWidth, height: nextHeight });
    } else {
      // scale: 计算两轴归一化平均值 → 比例
      const dx = -tmp.deltaLocal.x / (startWidthRef.current / 2);
      const dy = -tmp.deltaLocal.y / (startHeightRef.current / 2);
      const ds = (dx + dy) / 2;
      useXRPanelStore.getState().setScale(startScaleRef.current * (1 + ds));
    }
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!draggingRef.current) return;
    e.stopPropagation();
    draggingRef.current = false;
    const targetEl = e.target as unknown as {
      releasePointerCapture?: (id: number) => void;
    };
    if (targetEl?.releasePointerCapture) targetEl.releasePointerCapture(e.pointerId);
    else gl.domElement.releasePointerCapture(e.pointerId);
  };

  const disabledRaycast = () => null;

  if (!active) return null;

  return (
    <group position={cornerLocal} renderOrder={10}>
      {/* Hit area */}
      <mesh
        position={hitOffset}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerEnter={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerLeave={(e) => {
          e.stopPropagation();
          setHover(false);
        }}
      >
        <planeGeometry args={[HIT_SIZE, HIT_SIZE]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={DoubleSide} />
      </mesh>

      {/* Ring visual */}
      <mesh position={ringOffset} geometry={ringGeometry} raycast={disabledRaycast}>
        <meshBasicMaterial
          color="#000000"
          transparent
          opacity={hover ? 0.7 : 0.4}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}
