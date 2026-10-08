import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Text, Billboard, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Scatter3DItem, SerializedDoc, FieldValue, Transform3D, RecordDoc, FieldDef } from '@coxr/shared';
import { applyView } from '@coxr/shared';
import { useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SCENE_RANGE = 4; // 归一化后 XYZ 各轴最大范围（世界单位）

// ── 辅助 ──────────────────────────────────────────────────────────────────────

function toDisplayStr(v: FieldValue, fieldDef?: FieldDef): string {
  if (v == null) return '—';
  if (typeof v === 'boolean') return v ? '是' : '否';
  if (fieldDef?.type === 'select' && typeof v === 'string') {
    return fieldDef.options.find((o) => o.id === v)?.name ?? v;
  }
  if (fieldDef?.type === 'multiSelect' && Array.isArray(v)) {
    return v.map((id) => fieldDef.options.find((o) => o.id === id)?.name ?? id).join(', ');
  }
  return String(v);
}

function toNumber(v: FieldValue): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalize(val: number, min: number, max: number, outMax: number): number {
  if (max === min) return outMax / 2;
  return ((val - min) / (max - min)) * outMax;
}

// ── 数据卡片（点击散点后弹出，始终朝向用户）──────────────────────────────────

function DataCard({
  record,
  fieldDefs,
  pointPos,
}: {
  record: RecordDoc;
  fieldDefs: FieldDef[];
  pointPos: [number, number, number];
}) {
  const CARD_W = 1.8;
  const LINE_H = 0.22;
  const PAD_V = 0.18;
  const cardH = PAD_V * 2 + fieldDefs.length * LINE_H;
  const [px, py, pz] = pointPos;

  return (
    <Billboard
      position={[px, py + cardH / 2 + 0.28, pz]}
      follow
      lockX={false}
      lockY={false}
      lockZ={false}
    >
      {/* 紫色边框 */}
      <mesh renderOrder={10} position={[0, 0, -0.003]}>
        <planeGeometry args={[CARD_W + 0.03, cardH + 0.03]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* 浅色背景 */}
      <mesh renderOrder={10}>
        <planeGeometry args={[CARD_W, cardH]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.96} depthWrite={false} />
      </mesh>
      {/* 字段行 */}
      {fieldDefs.map((def, i) => (
        <Text
          key={def.id}
          position={[-CARD_W / 2 + 0.12, cardH / 2 - PAD_V - (i + 0.5) * LINE_H, 0.005]}
          fontSize={0.13}
          color={i === 0 ? '#4338ca' : '#1f2937'}
          anchorX="left"
          anchorY="middle"
          maxWidth={CARD_W - 0.2}
          renderOrder={11}
        >
          {`${def.name}  ${toDisplayStr((record.data as Record<string, FieldValue>)[def.id] ?? null, def)}`}
        </Text>
      ))}
    </Billboard>
  );
}

// ── 单个散点 ──────────────────────────────────────────────────────────────────

function ScatterPoint({
  pos,
  radius,
  color,
  label,
  selected,
  onClick,
}: {
  pos: [number, number, number];
  radius: number;
  color: THREE.Color;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <group position={pos}>
      <mesh onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[radius, 16, 12]} />
        <meshStandardMaterial
          color={selected ? '#ffffff' : color}
          roughness={0.35}
          metalness={selected ? 0.4 : 0.15}
          emissive={selected ? color : new THREE.Color(0x000000)}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      {/* 悬浮标签（仅在未选中时显示，选中改为数据卡片） */}
      {!selected && (
        <Billboard position={[0, radius + 0.15, 0]} follow>
          <Text fontSize={0.14} color="#374151" anchorX="center" anchorY="bottom" renderOrder={2}>
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── 坐标轴 ────────────────────────────────────────────────────────────────────

function Axes({
  xLabel,
  yLabel,
  zLabel,
  range,
  isTransformMode,
  isInXR,
  onOriginClick,
}: {
  xLabel: string;
  yLabel: string;
  zLabel: string;
  range: number;
  isTransformMode: boolean;
  isInXR: boolean;
  onOriginClick: () => void;
}) {
  const axisLen = range + 0.5;
  const R = 0.025;
  const HR = 0.08; // 宽碰撞体半径

  return (
    <group>
      {/* 原点球 */}
      <mesh onClick={(e) => { e.stopPropagation(); onOriginClick(); }}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={isTransformMode ? '#f59e0b' : '#e2e8f0'}
          emissive={isTransformMode ? '#f59e0b' : '#334155'}
          emissiveIntensity={isTransformMode ? 0.7 : 0.4}
        />
      </mesh>

      {/* X 轴 */}
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[axisLen / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, axisLen, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[axisLen / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}>
        <cylinderGeometry args={[HR, HR, axisLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[axisLen + 0.22, 0, 0]} follow>
        <Text fontSize={0.2} color="#ef4444" anchorX="left" renderOrder={2}>{xLabel}</Text>
      </Billboard>

      {/* Y 轴 */}
      <mesh position={[0, axisLen / 2, 0]}>
        <cylinderGeometry args={[R, R, axisLen, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh position={[0, axisLen / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}>
        <cylinderGeometry args={[HR, HR, axisLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[0, axisLen + 0.22, 0]} follow>
        <Text fontSize={0.2} color="#22c55e" anchorX="center" renderOrder={2}>{yLabel}</Text>
      </Billboard>

      {/* Z 轴 */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, axisLen / 2]}>
        <cylinderGeometry args={[R, R, axisLen, 8]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, axisLen / 2]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}>
        <cylinderGeometry args={[HR, HR, axisLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {zLabel && (
        <Billboard position={[0, 0, axisLen + 0.22]} follow>
          <Text fontSize={0.2} color="#3b82f6" anchorX="center" renderOrder={2}>{zLabel}</Text>
        </Billboard>
      )}

      {/* 变换模式提示 */}
      {isTransformMode && (
        <Billboard position={[0, axisLen + 0.65, 0]} follow>
          <Text fontSize={0.15} color="#d97706" anchorX="center" renderOrder={2}>
            {isInXR ? '变换模式（PC 端使用 W/E/R 调整）' : 'W 平移  E 旋转  R 缩放  Esc 退出'}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── XR 变换控制面板 ────────────────────────────────────────────────────────────

type TransformAxis = 'position' | 'rotation' | 'scale';

function XRTransformPanel({
  transform,
  onAdjust,
}: {
  transform: Transform3D;
  onAdjust: (axis: TransformAxis, idx: number, delta: number) => void;
}) {
  const STEP_POS = 0.25;
  const STEP_ROT = 15;
  const STEP_SCL = 0.1;

  const rows: Array<{ label: string; axis: TransformAxis; idx: number; step: number; current: number }> = [
    { label: '位移 X', axis: 'position', idx: 0, step: STEP_POS, current: transform.position[0] },
    { label: '位移 Y', axis: 'position', idx: 1, step: STEP_POS, current: transform.position[1] },
    { label: '位移 Z', axis: 'position', idx: 2, step: STEP_POS, current: transform.position[2] },
    { label: '旋转 Y', axis: 'rotation', idx: 1, step: STEP_ROT, current: transform.rotation[1] },
    { label: '缩放',   axis: 'scale',    idx: 0, step: STEP_SCL, current: transform.scale[0] },
  ];

  const ROW_H = 0.32;
  const BTN_W = 0.3;
  const BTN_H = 0.25;
  const PANEL_W = 1.6;
  const PANEL_H = rows.length * ROW_H + 0.3;

  return (
    <Billboard position={[0, SCENE_RANGE + 1.5, 0]} follow>
      <mesh renderOrder={10} position={[0, 0, -0.003]}>
        <planeGeometry args={[PANEL_W + 0.025, PANEL_H + 0.025]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh renderOrder={10}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94} depthWrite={false} />
      </mesh>
      <Text position={[0, PANEL_H / 2 - 0.13, 0.005]} fontSize={0.13} color="#4338ca" anchorX="center" anchorY="middle" renderOrder={11}>
        变换调整
      </Text>
      {rows.map((row, i) => {
        const y = PANEL_H / 2 - 0.27 - i * ROW_H;
        const btnX_minus = PANEL_W / 2 - BTN_W * 1.55;
        const btnX_plus  = PANEL_W / 2 - BTN_W * 0.55;
        return (
          <group key={row.label} position={[0, y, 0.004]}>
            <Text position={[-PANEL_W / 2 + 0.12, 0, 0]} fontSize={0.12} color="#1f2937" anchorX="left" anchorY="middle" renderOrder={11}>
              {`${row.label}  ${row.current.toFixed(2)}`}
            </Text>
            <mesh position={[btnX_minus, 0, 0]} renderOrder={12}
              onClick={(e) => { e.stopPropagation(); onAdjust(row.axis, row.idx, -row.step); }}>
              <planeGeometry args={[BTN_W, BTN_H]} />
              <meshBasicMaterial color="#dc2626" transparent opacity={0.88} depthWrite={false} />
            </mesh>
            <Text position={[btnX_minus, 0, 0.003]} fontSize={0.18} color="white" anchorX="center" anchorY="middle" renderOrder={13}>−</Text>
            <mesh position={[btnX_plus, 0, 0]} renderOrder={12}
              onClick={(e) => { e.stopPropagation(); onAdjust(row.axis, row.idx, row.step); }}>
              <planeGeometry args={[BTN_W, BTN_H]} />
              <meshBasicMaterial color="#16a34a" transparent opacity={0.88} depthWrite={false} />
            </mesh>
            <Text position={[btnX_plus, 0, 0.003]} fontSize={0.18} color="white" anchorX="center" anchorY="middle" renderOrder={13}>＋</Text>
          </group>
        );
      })}
    </Billboard>
  );
}

// ── Scatter3DChart ─────────────────────────────────────────────────────────────

export function Scatter3DChart({
  item,
  doc,
  onTransformChange,
}: {
  item: Scatter3DItem;
  doc: SerializedDoc;
  onTransformChange?: (t: Transform3D) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const { controls } = useThree();
  const isInXR = useXR((s) => s.session != null);

  const view = doc.views[item.sourceViewId];
  const recordType = view ? doc.recordTypes[view.recordTypeId] : undefined;

  // 从 Yjs 同步变换（非变换模式时）
  useEffect(() => {
    if (!groupRef.current || isTransformMode) return;
    const t = item.transform3d;
    groupRef.current.position.set(t.position[0], t.position[1], t.position[2]);
    groupRef.current.rotation.set(
      t.rotation[0] * DEG2RAD, t.rotation[1] * DEG2RAD, t.rotation[2] * DEG2RAD,
    );
    groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2]);
  }, [item.transform3d, isTransformMode]);

  useEffect(() => {
    if (!isTransformMode && controls) {
      (controls as unknown as { enabled: boolean }).enabled = true;
    }
  }, [isTransformMode, controls]);

  useEffect(() => {
    if (!isTransformMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsTransformMode(false); return; }
      if (e.key === 'w') setTransformMode('translate');
      if (e.key === 'e') setTransformMode('rotate');
      if (e.key === 'r') setTransformMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTransformMode]);

  const rows = useMemo(() => {
    if (!view) return [];
    return applyView(doc, view);
  }, [doc, view]);

  const fieldDefs = useMemo(() => {
    if (!recordType) return [];
    return recordType.fieldOrder
      .map((id) => recordType.fields[id])
      .filter((f): f is FieldDef => Boolean(f));
  }, [recordType]);

  const xFieldName = item.xField && recordType ? (recordType.fields[item.xField]?.name ?? 'X') : 'X';
  const yFieldName = item.yField && recordType ? (recordType.fields[item.yField]?.name ?? 'Y') : 'Y';
  const zFieldName = item.zField && recordType ? (recordType.fields[item.zField]?.name ?? 'Z') : 'Z';

  const { points, colorCategories } = useMemo(() => {
    if (!item.xField || !item.yField) return { points: [], colorCategories: [] };

    const xFieldDef = item.xField ? recordType?.fields[item.xField] : undefined;
    const colorFieldDef = item.colorField ? recordType?.fields[item.colorField] : undefined;

    const xVals = rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.xField!] ?? null));
    const yVals = rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.yField!] ?? null));
    const zVals = item.zField
      ? rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.zField!] ?? null))
      : rows.map(() => 0);
    const sizeVals = item.sizeField
      ? rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.sizeField!] ?? null))
      : null;

    const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
    const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
    const zMin = Math.min(...zVals), zMax = Math.max(...zVals);
    const sMin = sizeVals ? Math.min(...sizeVals) : 1;
    const sMax = sizeVals ? Math.max(...sizeVals) : 1;

    // 颜色分类
    const colorCatMap = new Map<string, number>();
    const colorCategories: string[] = [];
    if (item.colorField) {
      for (const r of rows) {
        const v = toDisplayStr((r.data as Record<string, FieldValue>)[item.colorField!] ?? null, colorFieldDef);
        if (!colorCatMap.has(v)) { colorCatMap.set(v, colorCategories.length); colorCategories.push(v); }
      }
    }

    const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

    const points = rows.map((r, i) => {
      const x = normalize(xVals[i] ?? 0, xMin, xMax, SCENE_RANGE);
      const y = normalize(yVals[i] ?? 0, yMin, yMax, SCENE_RANGE);
      const z = item.zField ? normalize(zVals[i] ?? 0, zMin, zMax, SCENE_RANGE) : 0;

      const radius = sizeVals
        ? 0.02 + normalize(sizeVals[i] ?? 0, sMin, sMax, 0.1)
        : 0.1;

      const colorIdx = item.colorField
        ? (colorCatMap.get(toDisplayStr((r.data as Record<string, FieldValue>)[item.colorField!] ?? null, colorFieldDef)) ?? i)
        : i;

      const label = item.xField
        ? toDisplayStr((r.data as Record<string, FieldValue>)[item.xField!] ?? null, xFieldDef)
        : String(i + 1);

      return {
        id: r.id,
        pos: [x, y, z] as [number, number, number],
        radius,
        color: new THREE.Color(palette[colorIdx % palette.length]),
        label,
      };
    });

    return { points, colorCategories };
  }, [rows, item.xField, item.yField, item.zField, item.colorField, item.sizeField]);

  const handleOriginClick = useCallback(() => {
    setIsTransformMode((v) => !v);
    setSelectedRecordId(null);
  }, []);

  const handlePointClick = useCallback((recordId: string) => {
    setSelectedRecordId((v) => (v === recordId ? null : recordId));
    setIsTransformMode(false);
  }, []);

  const handleMouseDown = useCallback(() => {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false;
  }, [controls]);

  const handleMouseUp = useCallback(() => {
    if (controls) (controls as unknown as { enabled: boolean }).enabled = true;
    if (!groupRef.current || !onTransformChange) return;
    const pos = groupRef.current.position;
    const rot = groupRef.current.rotation;
    const scl = groupRef.current.scale;
    onTransformChange({
      position: [pos.x, pos.y, pos.z],
      rotation: [rot.x * RAD2DEG, rot.y * RAD2DEG, rot.z * RAD2DEG],
      scale: [scl.x, scl.y, scl.z],
    });
  }, [controls, onTransformChange]);

  const handleXRAdjust = useCallback((axis: TransformAxis, idx: number, delta: number) => {
    if (!onTransformChange) return;
    const t = item.transform3d;
    let newArr: [number, number, number];
    if (axis === 'scale') {
      const newVal = Math.max(0.1, t.scale[0] + delta);
      newArr = [newVal, newVal, newVal];
    } else {
      const src = t[axis];
      newArr = [src[0], src[1], src[2]];
      newArr[idx as 0 | 1 | 2] += delta;
    }
    const newT: Transform3D = { ...t, [axis]: newArr };
    onTransformChange(newT);
    if (groupRef.current) {
      if (axis === 'position') groupRef.current.position.set(...newT.position);
      if (axis === 'rotation') groupRef.current.rotation.set(
        newT.rotation[0] * DEG2RAD, newT.rotation[1] * DEG2RAD, newT.rotation[2] * DEG2RAD,
      );
      if (axis === 'scale') groupRef.current.scale.set(...newT.scale);
    }
  }, [item.transform3d, onTransformChange]);

  const selectedRecord = selectedRecordId ? (rows.find((r) => r.id === selectedRecordId) ?? null) : null;
  const selectedPoint = selectedRecordId ? (points.find((p) => p.id === selectedRecordId) ?? null) : null;

  return (
    <>
      {isTransformMode && !isInXR && groupRef.current && (
        <TransformControls
          object={groupRef.current}
          mode={transformMode}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        />
      )}
      <group ref={groupRef}>
        <Axes
          xLabel={xFieldName}
          yLabel={yFieldName}
          zLabel={item.zField ? zFieldName : ''}
          range={SCENE_RANGE}
          isTransformMode={isTransformMode}
          isInXR={isInXR}
          onOriginClick={handleOriginClick}
        />
        {points.map((pt) => (
          <ScatterPoint
            key={pt.id}
            pos={pt.pos}
            radius={pt.radius}
            color={pt.color}
            label={pt.label}
            selected={pt.id === selectedRecordId}
            onClick={() => handlePointClick(pt.id)}
          />
        ))}
        {selectedRecord && selectedPoint && (
          <DataCard
            record={selectedRecord}
            fieldDefs={fieldDefs}
            pointPos={selectedPoint.pos}
          />
        )}
        {isTransformMode && isInXR && (
          <XRTransformPanel
            transform={item.transform3d}
            onAdjust={handleXRAdjust}
          />
        )}
      </group>
    </>
  );
}
