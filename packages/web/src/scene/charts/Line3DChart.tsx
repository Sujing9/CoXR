import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Text, Billboard, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Line3DItem, SerializedDoc, FieldValue, Transform3D, RecordDoc, FieldDef } from '@coxr/shared';
import { applyView } from '@coxr/shared';
import { useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const SCENE_RANGE = 4; // X/Y 各轴归一化后最大世界单位

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

const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#ef4444', '#14b8a6', '#8b5cf6',
];

// ── 数据卡片 ──────────────────────────────────────────────────────────────────

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
      <mesh renderOrder={10} position={[0, 0, -0.003]}>
        <planeGeometry args={[CARD_W + 0.03, cardH + 0.03]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <mesh renderOrder={10}>
        <planeGeometry args={[CARD_W, cardH]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.96} depthWrite={false} />
      </mesh>
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

// ── 单条折线（一个系列）──────────────────────────────────────────────────────

interface SeriesPoint {
  recordId: string;
  x: number;
  y: number;
  label: string;
}

function LineSeries({
  points,
  color,
  selectedRecordId,
  onPointClick,
}: {
  points: SeriesPoint[];
  color: string;
  selectedRecordId: string | null;
  onPointClick: (recordId: string, pos: [number, number, number]) => void;
}) {
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  // 折线管 (CatmullRomCurve3 → TubeGeometry)
  const tubeGeo = useMemo(() => {
    if (points.length < 2) return null;
    const vectors = points.map((p) => new THREE.Vector3(p.x, p.y, 0));
    const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal', 0.5);
    return new THREE.TubeGeometry(curve, Math.max(points.length * 4, 32), 0.025, 8, false);
  }, [points]);

  return (
    <group>
      {/* 管道折线 */}
      {tubeGeo && (
        <mesh geometry={tubeGeo}>
          <meshStandardMaterial
            color={threeColor}
            roughness={0.4}
            metalness={0.2}
            emissive={threeColor}
            emissiveIntensity={0.15}
          />
        </mesh>
      )}

      {/* 节点球 */}
      {points.map((p) => {
        const isSelected = p.recordId === selectedRecordId;
        const pos: [number, number, number] = [p.x, p.y, 0];
        return (
          <group key={p.recordId} position={pos}>
            <mesh
              onClick={(e) => { e.stopPropagation(); onPointClick(p.recordId, pos); }}
            >
              <sphereGeometry args={[isSelected ? 0.09 : 0.06, 14, 10]} />
              <meshStandardMaterial
                color={isSelected ? '#ffffff' : threeColor}
                roughness={0.3}
                metalness={isSelected ? 0.4 : 0.15}
                emissive={threeColor}
                emissiveIntensity={isSelected ? 0.5 : 0.1}
              />
            </mesh>
            {!isSelected && (
              <Billboard position={[0, 0.2, 0]} follow>
                <Text fontSize={0.12} color="#4b5563" anchorX="center" anchorY="bottom" renderOrder={2}>
                  {p.label}
                </Text>
              </Billboard>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ── 坐标轴 ────────────────────────────────────────────────────────────────────

function Axes({
  xLabel,
  yLabel,
  range,
  isTransformMode,
  isInXR,
  onOriginClick,
}: {
  xLabel: string;
  yLabel: string;
  range: number;
  isTransformMode: boolean;
  isInXR: boolean;
  onOriginClick: () => void;
}) {
  const axisLen = range + 0.5;
  const R = 0.025;
  const HR = 0.08;

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

      {/* 变换模式提示 */}
      {isTransformMode && (
        <Billboard position={[0, axisLen + 0.65, 0]} follow>
          <Text fontSize={0.15} color="#d97706" anchorX="center" renderOrder={2}>
            {isInXR ? '变换模式' : 'W 平移  E 旋转  R 缩放  Esc 退出'}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── XR 变换面板 ───────────────────────────────────────────────────────────────

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

// ── Line3DChart ────────────────────────────────────────────────────────────────

export function Line3DChart({
  item,
  doc,
  onTransformChange,
}: {
  item: Line3DItem;
  doc: SerializedDoc;
  onTransformChange?: (t: Transform3D) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [isTransformMode, setIsTransformMode] = useState(false);
  const [transformMode, setTransformMode] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedPos, setSelectedPos] = useState<[number, number, number] | null>(null);
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

  // 计算各系列的点坐标
  const seriesMap = useMemo(() => {
    if (!item.yField) return new Map<string, SeriesPoint[]>();

    const yVals = rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.yField!] ?? null));
    const yMin = Math.min(...yVals);
    const yMax = Math.max(...yVals);

    // X：如果有 xField 则用字段值顺序（保持原始记录顺序），否则用行下标
    const xStep = rows.length > 1 ? SCENE_RANGE / (rows.length - 1) : 0;

    // 按 colorField 分组
    const result = new Map<string, SeriesPoint[]>();

    const xFieldDef = item.xField ? recordType?.fields[item.xField] : undefined;
    const colorFieldDef = item.colorField ? recordType?.fields[item.colorField] : undefined;

    rows.forEach((r, i) => {
      const seriesKey = item.colorField
        ? toDisplayStr((r.data as Record<string, FieldValue>)[item.colorField!] ?? null, colorFieldDef)
        : '__default__';

      const x = xStep * i;
      const y = normalize(yVals[i] ?? 0, yMin, yMax, SCENE_RANGE);
      const label = item.xField
        ? toDisplayStr((r.data as Record<string, FieldValue>)[item.xField!] ?? null, xFieldDef)
        : String(i + 1);

      if (!result.has(seriesKey)) result.set(seriesKey, []);
      result.get(seriesKey)!.push({ recordId: r.id, x, y, label });
    });

    return result;
  }, [rows, item.xField, item.yField, item.colorField]);

  const seriesKeys = useMemo(() => Array.from(seriesMap.keys()), [seriesMap]);

  const handleOriginClick = useCallback(() => {
    setIsTransformMode((v) => !v);
    setSelectedRecordId(null);
    setSelectedPos(null);
  }, []);

  const handlePointClick = useCallback((recordId: string, pos: [number, number, number]) => {
    setSelectedRecordId((v) => {
      if (v === recordId) { setSelectedPos(null); return null; }
      setSelectedPos(pos);
      return recordId;
    });
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
          range={SCENE_RANGE}
          isTransformMode={isTransformMode}
          isInXR={isInXR}
          onOriginClick={handleOriginClick}
        />

        {seriesKeys.map((key, si) => {
          const pts = seriesMap.get(key)!;
          const color = PALETTE[si % PALETTE.length]!;
          return (
            <group key={key}>
              <LineSeries
                points={pts}
                color={color}
                selectedRecordId={selectedRecordId}
                onPointClick={handlePointClick}
              />
              {/* 系列图例（右上角，只在多系列时显示） */}
              {seriesKeys.length > 1 && (
                <Billboard position={[SCENE_RANGE + 0.5, SCENE_RANGE - si * 0.4, 0]} follow>
                  <Text fontSize={0.14} color={color} anchorX="left" anchorY="middle" renderOrder={2}>
                    ● {key}
                  </Text>
                </Billboard>
              )}
            </group>
          );
        })}

        {selectedRecord && selectedPos && (
          <DataCard
            record={selectedRecord}
            fieldDefs={fieldDefs}
            pointPos={selectedPos}
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
