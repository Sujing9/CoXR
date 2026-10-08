import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { type MeshBasicMaterial } from 'three';
import { Text } from '@react-three/drei';
import { FONTS } from '@/constants/world';
import { useRoundedRectGeometry, parseRGBA } from './primitives';

export type StatusKind = 'info' | 'success' | 'error';

export interface StatusMsg {
  kind: StatusKind;
  text: string;
  /** 局部唯一 id，便于触发同文案重置计时 */
  nonce: number;
}

interface StatusBarProps {
  status: StatusMsg | null;
  onClear: () => void;
  width: number;
  /** 浮层 y（content 区域局部，建议为 height/2 - HEIGHT/2） */
  y: number;
}

const COLORS: Record<StatusKind, string> = {
  info: 'rgba(50, 80, 180, 0.85)',
  success: 'rgba(30, 120, 60, 0.85)',
  error: 'rgba(180, 30, 30, 0.85)',
};

const HEIGHT = 0.044;
const SHOW_MS = 2500;
const FADE_IN_MS = 200;
const FADE_OUT_MS = 250;

type Phase = 'in' | 'hold' | 'out' | 'idle';

/**
 * 浮层式状态条：
 * - 不占布局（z=+0.003 覆盖在 body 上方）
 * - 200ms 淡入 → 2500ms 保持 → 250ms 淡出 → 卸载
 * - status.nonce 变化会重置动画并替换内容
 */
export function StatusBar({ status, onClear, width, y }: StatusBarProps) {
  const geo = useRoundedRectGeometry(width, HEIGHT, 0.010);

  const [shown, setShown] = useState<StatusMsg | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const phaseStartRef = useRef(0);
  const matRef = useRef<MeshBasicMaterial>(null);
  const textMatRef = useRef<MeshBasicMaterial | null>(null);

  const baseOpacityRef = useRef(0.65);

  useEffect(() => {
    if (status) {
      setShown(status);
      baseOpacityRef.current = parseRGBA(COLORS[status.kind]).opacity;
      phaseRef.current = 'in';
      phaseStartRef.current = performance.now();
    }
    // 不在外部 clear 时立刻卸载——交给淡出阶段。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.nonce]);

  useFrame(() => {
    if (phaseRef.current === 'idle') return;
    const now = performance.now();
    const elapsed = now - phaseStartRef.current;
    let t = 1;

    if (phaseRef.current === 'in') {
      t = Math.min(1, elapsed / FADE_IN_MS);
      if (elapsed >= FADE_IN_MS) {
        phaseRef.current = 'hold';
        phaseStartRef.current = now;
      }
    } else if (phaseRef.current === 'hold') {
      t = 1;
      if (elapsed >= SHOW_MS) {
        phaseRef.current = 'out';
        phaseStartRef.current = now;
      }
    } else if (phaseRef.current === 'out') {
      t = Math.max(0, 1 - elapsed / FADE_OUT_MS);
      if (elapsed >= FADE_OUT_MS) {
        phaseRef.current = 'idle';
        setShown(null);
        onClear();
        return;
      }
    }

    if (matRef.current) matRef.current.opacity = baseOpacityRef.current * t;
    if (textMatRef.current) textMatRef.current.opacity = t;
  });

  if (!shown) return null;

  const { color } = parseRGBA(COLORS[shown.kind]);

  return (
    <group position={[0, y, 0.003]} renderOrder={50}>
      <mesh geometry={geo} renderOrder={50}>
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>
      <Text
        font={FONTS.DEFAULT}
        fontSize={0.020}
        color="#fff"
        anchorX="center"
        anchorY="middle"
        position={[0, 0, 0.0008]}
        renderOrder={51}
        onSync={(troika: { material?: MeshBasicMaterial }) => {
          if (troika.material) {
            troika.material.transparent = true;
            troika.material.depthTest = false;
            troika.material.depthWrite = false;
            textMatRef.current = troika.material;
          }
        }}
      >
        {shown.text}
      </Text>
    </group>
  );
}
