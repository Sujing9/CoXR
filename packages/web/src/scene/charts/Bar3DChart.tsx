import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Text, Billboard, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Bar3DItem, SerializedDoc, FieldDef, FieldValue, Transform3D, RecordDoc } from '@coxr/shared';
import { applyView } from '@coxr/shared';
import { useThree } from '@react-three/fiber';
import { useXR } from '@react-three/xr';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const MAX_BAR_H = 4; // 归一化后最大柱高（世界单位）
const _BLACK = new THREE.Color(0x000000); // 零发射色，模块层复用避免每帧分配

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

// ── 数据卡片（点击柱子后弹出，始终朝向用户）─────────────────────────────────

function DataCard({
  record,
  fieldDefs,
  barTopY,
  barX,
  barZ,
}: {
  record: RecordDoc;
  fieldDefs: FieldDef[];
  barTopY: number;
  barX: number;
  barZ: number;
}) {
  const CARD_W = 1.8;
  const LINE_H = 0.22;
  const PAD_V = 0.18;
  const cardH = PAD_V * 2 + fieldDefs.length * LINE_H;
  const cardY = barTopY + cardH / 2 + 0.28;

  return (
    <Billboard position={[barX, cardY, barZ]} follow lockX={false} lockY={false} lockZ={false}>
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

// ── 单根柱子 ──────────────────────────────────────────────────────────────────

function Bar({
  x,
  z,
  normalizedH,
  rawValue,
  color,
  label,
  selected,
  onClick,
  barWidth = 0.6,
  showValue = true,
  showLabel = true,
}: {
  x: number;
  z: number;
  normalizedH: number;
  rawValue: number;
  color: THREE.Color;
  label: string;
  selected: boolean;
  onClick: () => void;
  barWidth?: number;
  showValue?: boolean;
  showLabel?: boolean;
}) {
  const emissiveColor = selected ? color : _BLACK;

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, normalizedH / 2, 0]}
        castShadow
        onClick={(e) => { e.stopPropagation(); onClick(); }}
      >
        <boxGeometry args={[barWidth, normalizedH, barWidth]} />
        <meshStandardMaterial
          color={selected ? '#ffffff' : color}
          roughness={0.4}
          metalness={selected ? 0.4 : 0.1}
          emissive={emissiveColor}
          emissiveIntensity={selected ? 0.35 : 0}
        />
      </mesh>
      {/* 顶部数值（选中时隐藏，改为数据卡片显示） */}
      {!selected && showValue && (
        <Billboard position={[0, normalizedH + 0.22, 0]} follow>
          <Text fontSize={0.17} color="#374151" anchorX="center" anchorY="bottom" renderOrder={2}>
            {rawValue.toFixed(1)}
          </Text>
        </Billboard>
      )}
      {/* 底部类别标签，始终朝向用户 */}
      {showLabel && (
        <Billboard position={[0, -0.15, 0]} follow>
          <Text
            fontSize={0.15}
            color="#4b5563"
            anchorX="center"
            anchorY="top"
            maxWidth={0.9}
            renderOrder={2}
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── XR 变换控制面板（射线点击 +/- 按钮）─────────────────────────────────────

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
    <Billboard position={[0, MAX_BAR_H + 1.5, 0]} follow>
      {/* 边框 */}
      <mesh renderOrder={10} position={[0, 0, -0.003]}>
        <planeGeometry args={[PANEL_W + 0.025, PANEL_H + 0.025]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {/* 背景 */}
      <mesh renderOrder={10}>
        <planeGeometry args={[PANEL_W, PANEL_H]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.94} depthWrite={false} />
      </mesh>
      {/* 标题 */}
      <Text
        position={[0, PANEL_H / 2 - 0.13, 0.005]}
        fontSize={0.13}
        color="#4338ca"
        anchorX="center"
        anchorY="middle"
        renderOrder={11}
      >
        变换调整
      </Text>

      {rows.map((row, i) => {
        const y = PANEL_H / 2 - 0.27 - i * ROW_H;
        const btnX_minus = PANEL_W / 2 - BTN_W * 1.55;
        const btnX_plus  = PANEL_W / 2 - BTN_W * 0.55;
        return (
          <group key={row.label} position={[0, y, 0.004]}>
            {/* 行标签 + 当前值 */}
            <Text
              position={[-PANEL_W / 2 + 0.12, 0, 0]}
              fontSize={0.12}
              color="#1f2937"
              anchorX="left"
              anchorY="middle"
              renderOrder={11}
            >
              {`${row.label}  ${row.current.toFixed(2)}`}
            </Text>
            {/* − 按钮 */}
            <mesh
              position={[btnX_minus, 0, 0]}
              renderOrder={12}
              onClick={(e) => { e.stopPropagation(); onAdjust(row.axis, row.idx, -row.step); }}
            >
              <planeGeometry args={[BTN_W, BTN_H]} />
              <meshBasicMaterial color="#dc2626" transparent opacity={0.88} depthWrite={false} />
            </mesh>
            <Text position={[btnX_minus, 0, 0.003]} fontSize={0.18} color="white" anchorX="center" anchorY="middle" renderOrder={13}>−</Text>
            {/* ＋ 按钮 */}
            <mesh
              position={[btnX_plus, 0, 0]}
              renderOrder={12}
              onClick={(e) => { e.stopPropagation(); onAdjust(row.axis, row.idx, row.step); }}
            >
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

// ── 坐标轴 ────────────────────────────────────────────────────────────────────

function Axes({
  xLabel,
  yLabel,
  zLabel,
  xLen,
  zLen,
  isTransformMode,
  isInXR,
  onOriginClick,
}: {
  xLabel: string;
  yLabel: string;
  zLabel: string;
  xLen: number;
  zLen: number;
  isTransformMode: boolean;
  isInXR: boolean;
  onOriginClick: () => void;
}) {
  const yLen = MAX_BAR_H + 0.6;
  const R = 0.025;     // 可见轴半径
  const HR = 0.08;     // 不可见碰撞体半径（XR 射线更容易命中）

  return (
    <group>
      {/* ── 原点球体：点击进入/退出变换模式 ── */}
      <mesh onClick={(e) => { e.stopPropagation(); onOriginClick(); }}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={isTransformMode ? '#f59e0b' : '#e2e8f0'}
          emissive={isTransformMode ? '#f59e0b' : '#334155'}
          emissiveIntensity={isTransformMode ? 0.7 : 0.4}
        />
      </mesh>

      {/* ── X 轴（红）── */}
      {/* 可见细轴 */}
      <mesh rotation={[0, 0, -Math.PI / 2]} position={[xLen / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, xLen, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* 不可见宽碰撞体 */}
      <mesh
        rotation={[0, 0, -Math.PI / 2]}
        position={[xLen / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}
      >
        <cylinderGeometry args={[HR, HR, xLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[xLen + 0.22, 0, 0]} follow>
        <Text fontSize={0.2} color="#ef4444" anchorX="left" renderOrder={2}>{xLabel}</Text>
      </Billboard>

      {/* ── Y 轴（绿）── */}
      <mesh position={[0, yLen / 2, 0]}>
        <cylinderGeometry args={[R, R, yLen, 8]} />
        <meshBasicMaterial color="#22c55e" />
      </mesh>
      <mesh
        position={[0, yLen / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}
      >
        <cylinderGeometry args={[HR, HR, yLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Billboard position={[0, yLen + 0.22, 0]} follow>
        <Text fontSize={0.2} color="#22c55e" anchorX="center" renderOrder={2}>{yLabel}</Text>
      </Billboard>

      {/* ── Z 轴（蓝）── */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, zLen / 2]}>
        <cylinderGeometry args={[R, R, zLen, 8]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, zLen / 2]}
        onClick={(e) => { e.stopPropagation(); onOriginClick(); }}
      >
        <cylinderGeometry args={[HR, HR, zLen, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {zLabel && (
        <Billboard position={[0, 0, zLen + 0.22]} follow>
          <Text fontSize={0.2} color="#3b82f6" anchorX="center" renderOrder={2}>{zLabel}</Text>
        </Billboard>
      )}

      {/* ── 变换模式提示 ── */}
      {isTransformMode && (
        <Billboard position={[0, yLen + 0.65, 0]} follow>
          <Text fontSize={0.15} color="#d97706" anchorX="center" renderOrder={2}>
            {isInXR ? '变换模式（PC 端使用 W/E/R 调整）' : 'W 平移  E 旋转  R 缩放  Esc 退出'}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

// ── Bar3DChart ─────────────────────────────────────────────────────────────────

export function Bar3DChart({
  item,
  doc,
  onTransformChange,
}: {
  item: Bar3DItem;
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

  // 从 Yjs 同步变换（仅在非变换模式时）
  useEffect(() => {
    if (!groupRef.current || isTransformMode) return;
    const t = item.transform3d;
    groupRef.current.position.set(t.position[0], t.position[1], t.position[2]);
    groupRef.current.rotation.set(
      t.rotation[0] * DEG2RAD,
      t.rotation[1] * DEG2RAD,
      t.rotation[2] * DEG2RAD,
    );
    groupRef.current.scale.set(t.scale[0], t.scale[1], t.scale[2]);
  }, [item.transform3d, isTransformMode]);

  // 退出变换模式时确保 OrbitControls 恢复
  useEffect(() => {
    if (!isTransformMode && controls) {
      (controls as unknown as { enabled: boolean }).enabled = true;
    }
  }, [isTransformMode, controls]);

  // 键盘快捷键（仅在变换模式激活时）
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

  const { bars, maxRaw, layout } = useMemo(() => {
    if (!item.xField || !item.yField) return { bars: [], maxRaw: 1, layout: { barWidth: 0.4, showValue: true, showLabel: true } };

    const xFieldDef = item.xField ? recordType?.fields[item.xField] : undefined;
    const zFieldDef = item.zField ? recordType?.fields[item.zField] : undefined;

    const xCategories: string[] = [];
    const xIndexMap = new Map<string, number>();
    const zCategories: string[] = [];
    const zIndexMap = new Map<string, number>();

    for (const row of rows) {
      const xRaw = toDisplayStr((row.data as Record<string, FieldValue>)[item.xField!] ?? null, xFieldDef);
      if (!xIndexMap.has(xRaw)) { xIndexMap.set(xRaw, xCategories.length); xCategories.push(xRaw); }
      if (item.zField) {
        const zRaw = toDisplayStr((row.data as Record<string, FieldValue>)[item.zField] ?? null, zFieldDef);
        if (!zIndexMap.has(zRaw)) { zIndexMap.set(zRaw, zCategories.length); zCategories.push(zRaw); }
      }
    }

    const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
    const maxRaw = Math.max(...rows.map((r) => toNumber((r.data as Record<string, FieldValue>)[item.yField!] ?? null)), 1);

    const totalBars = rows.length;
    const isLargeData = totalBars > 15;
    const isVeryLargeData = totalBars > 40;
    
    // 动态调整间距和柱体粗细，防止大数据量下过于拥挤
    const spacing = isVeryLargeData ? 0.2 : isLargeData ? 0.4 : 0.8;
    const barWidth = isVeryLargeData ? 0.1 : isLargeData ? 0.2 : 0.4;

    const bars = rows.map((row, i) => {
      const xStr = toDisplayStr((row.data as Record<string, FieldValue>)[item.xField!] ?? null, xFieldDef);
      const xIdx = xIndexMap.get(xStr) ?? 0;
      const yVal = toNumber((row.data as Record<string, FieldValue>)[item.yField!] ?? null);
      const normalizedH = Math.max((yVal / maxRaw) * MAX_BAR_H, 0.02);

      let zIdx = 0;
      if (item.zField) {
        const zStr = toDisplayStr((row.data as Record<string, FieldValue>)[item.zField] ?? null, zFieldDef);
        zIdx = zIndexMap.get(zStr) ?? 0;
      }

      const colorIdx = item.zField ? zIdx : i;
      return {
        id: row.id,
        x: xIdx * spacing,
        z: item.zField ? zIdx * spacing : 0,
        normalizedH,
        rawValue: yVal,
        label: xStr,
        color: new THREE.Color(palette[colorIdx % palette.length]),
      };
    });

    return { bars, maxRaw, layout: { barWidth, showValue: !isLargeData, showLabel: !isVeryLargeData } };
  }, [rows, item.xField, item.yField, item.zField]);

  // 轴长：略长于内容区
  const xAxisLen = (bars.length > 0 ? Math.max(...bars.map((b) => b.x)) + 1 : 1) + 0.5;
  const zAxisLen = (bars.length > 0 ? Math.max(...bars.map((b) => b.z)) + 1 : 1) + 0.5;

  const handleOriginClick = useCallback(() => {
    setIsTransformMode((v) => !v);
    setSelectedRecordId(null);
  }, []);

  const handleBarClick = useCallback((recordId: string) => {
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

  // XR 端：点击 +/- 按钮调整变换，直接操作 groupRef + 写入 Yjs
  const handleXRAdjust = useCallback((axis: TransformAxis, idx: number, delta: number) => {
    if (!onTransformChange) return;
    const t = item.transform3d;
    let newArr: [number, number, number];
    if (axis === 'scale') {
      // 均匀缩放
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
  const selectedBar = selectedRecordId ? (bars.find((b) => b.id === selectedRecordId) ?? null) : null;

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
          xLen={xAxisLen}
          zLen={zAxisLen}
          isTransformMode={isTransformMode}
          isInXR={isInXR}
          onOriginClick={handleOriginClick}
        />
        {bars.map((bar) => (
          <Bar
            key={bar.id}
            x={bar.x}
            z={bar.z}
            normalizedH={bar.normalizedH}
            rawValue={bar.rawValue}
            color={bar.color}
            label={bar.label}
            selected={bar.id === selectedRecordId}
            onClick={() => handleBarClick(bar.id)}
            barWidth={layout.barWidth}
            showValue={layout.showValue}
            showLabel={layout.showLabel}
          />
        ))}
        {selectedRecord && selectedBar && (
          <DataCard
            record={selectedRecord}
            fieldDefs={fieldDefs}
            barTopY={selectedBar.normalizedH}
            barX={selectedBar.x}
            barZ={selectedBar.z}
          />
        )}
        {/* XR 端变换面板：射线点击 +/- 按钮调整位移/旋转/缩放 */}
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
