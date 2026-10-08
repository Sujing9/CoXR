import { useMemo, useRef, useState, type RefObject } from 'react';
import { type ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  MathUtils,
  Plane,
  Quaternion,
  Vector3,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  type Ray,
} from 'three';
import { useXRPanelStore } from '../xrPanelStore';
import { useXRPanelUIStore } from '../xrPanelUIStore';

const PROXIMITY_RADIUS = 0.06;
const SPHERE_RADIUS = 0.018;
const GAP_Y = 0.06; // 小球距离面板下边框
const CLICK_MOVE_EPS = 0.005;

interface HomeSphereProps {
  /** 面板宽（米） */
  width: number;
  /** 面板高（米） */
  height: number;
  /** 面板根 group ref（用于平面对齐 + 反推 worldOffset） */
  panelGroupRef: RefObject<Group | null>;
}

function intersectRayWithPlane(ray: Ray, plane: Plane, out: Vector3): boolean {
  return ray.intersectPlane(plane, out) !== null;
}

/**
 * 面板下边框居中外侧的小球。
 * - proximity sphere（不可见、半径较大）触发显隐
 * - 拖拽：射线-面板平面求交 → 反推 worldOffset
 * - 点击（位移 < 阈值）→ 打开工具菜单
 */
export function HomeSphere({ width, height, panelGroupRef }: HomeSphereProps) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  const menuOpen = useXRPanelUIStore((s) => s.menuOpen);
  const openMenu = useXRPanelUIStore((s) => s.openMenu);

  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const isInProximityRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragMaxMoveSqRef = useRef(0);

  const dragPlaneRef = useRef(new Plane());
  const dragStartHitRef = useRef(new Vector3());
  const dragStartOffsetRef = useRef(new Vector3());
  const dragStartCameraRef = useRef(new Vector3());

  const sphereMeshRef = useRef<Mesh>(null);
  const sphereMatRef = useRef<MeshStandardMaterial>(null);
  void height; // height 通过 localPos 间接使用

  const tmp = useMemo(
    () => ({
      q: new Quaternion(),
      normal: new Vector3(),
      hit: new Vector3(),
      delta: new Vector3(),
      cam: new Vector3(),
      anchor: new Vector3(),
    }),
    [],
  );

  // 小球本地坐标：下边框居中再下移 GAP_Y
  const localPos: [number, number, number] = useMemo(() => {
    return [0, -height / 2 - GAP_Y, 0];
  }, [height]);

  void width;

  // ── Pointer handlers ────────────────────────────────────────────────

  const onProximityEnter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isInProximityRef.current = true;
    if (!menuOpen) setIsVisible(true);
  };

  const onProximityLeave = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isInProximityRef.current = false;
    if (isDraggingRef.current || menuOpen) return;
    setIsVisible(false);
  };

  const beginDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const panelGroup = panelGroupRef.current;
    if (!panelGroup) return;

    const targetEl = e.target as unknown as {
      setPointerCapture?: (id: number) => void;
      releasePointerCapture?: (id: number) => void;
    };
    if (targetEl?.setPointerCapture) targetEl.setPointerCapture(e.pointerId);
    else gl.domElement.setPointerCapture(e.pointerId);

    isDraggingRef.current = true;
    dragMaxMoveSqRef.current = 0;
    setIsVisible(true);

    // 1) 构建拖拽平面（面板法线 + 小球世界位置）
    panelGroup.getWorldQuaternion(tmp.q);
    tmp.normal.set(0, 0, 1).applyQuaternion(tmp.q).normalize();

    if (sphereMeshRef.current) {
      sphereMeshRef.current.getWorldPosition(tmp.anchor);
    } else {
      panelGroup.localToWorld(tmp.anchor.set(...localPos));
    }
    dragPlaneRef.current.setFromNormalAndCoplanarPoint(tmp.normal, tmp.anchor);

    // 2) 起始命中点 + 起始 worldOffset + 起始相机位置
    if (!intersectRayWithPlane(e.ray, dragPlaneRef.current, dragStartHitRef.current)) {
      isDraggingRef.current = false;
      if (targetEl?.releasePointerCapture) targetEl.releasePointerCapture(e.pointerId);
      else gl.domElement.releasePointerCapture(e.pointerId);
      return;
    }
    const o = useXRPanelStore.getState().worldOffset;
    dragStartOffsetRef.current.set(o.x, o.y, o.z);
    camera.getWorldPosition(dragStartCameraRef.current);
  };

  const updateDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();

    if (!intersectRayWithPlane(e.ray, dragPlaneRef.current, tmp.hit)) return;

    tmp.delta.copy(tmp.hit).sub(dragStartHitRef.current);
    dragMaxMoveSqRef.current = Math.max(dragMaxMoveSqRef.current, tmp.delta.lengthSq());

    // 起始 worldOffset 是基于起始相机位置的；现在相机可能也已经移动，
    // 实际写入：newOffset = startOffset + (handHit - startHandHit) - (camNow - camStart)
    camera.getWorldPosition(tmp.cam);
    const camDx = tmp.cam.x - dragStartCameraRef.current.x;
    const camDy = tmp.cam.y - dragStartCameraRef.current.y;
    const camDz = tmp.cam.z - dragStartCameraRef.current.z;

    useXRPanelStore.getState().setWorldOffset({
      x: dragStartOffsetRef.current.x + tmp.delta.x - camDx,
      y: dragStartOffsetRef.current.y + tmp.delta.y - camDy,
      z: dragStartOffsetRef.current.z + tmp.delta.z - camDz,
    });
  };

  const endDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();

    isDraggingRef.current = false;
    const targetEl = e.target as unknown as {
      releasePointerCapture?: (id: number) => void;
    };
    if (targetEl?.releasePointerCapture) targetEl.releasePointerCapture(e.pointerId);
    else gl.domElement.releasePointerCapture(e.pointerId);

    const movedSq = dragMaxMoveSqRef.current;
    const wasClick = movedSq <= CLICK_MOVE_EPS * CLICK_MOVE_EPS;
    if (wasClick) {
      openMenu();
      setIsVisible(true);
    } else if (!isInProximityRef.current && !menuOpen) {
      setIsVisible(false);
    }
  };

  // ── Spring animations ──────────────────────────────────────────────

  useFrame((_, delta) => {
    const targetOpacity = isVisible && !menuOpen ? 1 : 0;
    const targetScale = isVisible && !menuOpen ? 1 : 0;
    if (sphereMatRef.current) {
      sphereMatRef.current.opacity = MathUtils.damp(
        sphereMatRef.current.opacity,
        targetOpacity,
        15,
        delta,
      );
      sphereMatRef.current.emissiveIntensity = MathUtils.damp(
        sphereMatRef.current.emissiveIntensity,
        isHovered ? 0.6 : 0.15,
        12,
        delta,
      );
    }
    if (sphereMeshRef.current) {
      sphereMeshRef.current.scale.setScalar(
        MathUtils.damp(sphereMeshRef.current.scale.x, targetScale, 15, delta),
      );
    }
  });

  const disabledRaycast = () => null;

  return (
    <group position={localPos}>
      {/* Proximity 检测：大不可见球，常驻 raycast */}
      <mesh
        onPointerEnter={onProximityEnter}
        onPointerLeave={onProximityLeave}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
      >
        <sphereGeometry args={[PROXIMITY_RADIUS, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* 可见小球 */}
      <mesh
        ref={sphereMeshRef}
        scale={0}
        raycast={isVisible ? undefined : disabledRaycast}
        onPointerEnter={(e) => {
          if (!isVisible) return;
          e.stopPropagation();
          setIsHovered(true);
        }}
        onPointerLeave={(e) => {
          if (!isVisible) return;
          e.stopPropagation();
          setIsHovered(false);
        }}
        onPointerDown={beginDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
      >
        <sphereGeometry args={[SPHERE_RADIUS, 24, 24]} />
        <meshStandardMaterial
          ref={sphereMatRef}
          color="#222222"
          emissive="#000000"
          emissiveIntensity={0.15}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
