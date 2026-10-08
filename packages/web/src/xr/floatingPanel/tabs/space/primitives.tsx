import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text } from '@react-three/drei';
import { Shape, ShapeGeometry } from 'three';
import { FONTS } from '@/constants/world';

/**
 * 解析 "rgba(r, g, b, a)" → { color: "rgb(r,g,b)", opacity }
 * 因为 THREE.Color 不接受 rgba 字符串，必须把 alpha 拆出来给 material.opacity。
 */
export function parseRGBA(s: string): { color: string; opacity: number } {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return { color: s, opacity: 1 };
  const [, r, g, b, a] = m;
  return { color: `rgb(${r},${g},${b})`, opacity: a !== undefined ? parseFloat(a) : 1 };
}

export function useRoundedRectGeometry(width: number, height: number, radius: number) {
  const geo = useMemo(() => {
    const r = Math.min(radius, width / 2, height / 2);
    const w = width;
    const h = height;
    const x = -w / 2;
    const y = -h / 2;
    const s = new Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return new ShapeGeometry(s);
  }, [width, height, radius]);

  useEffect(() => () => { geo.dispose(); }, [geo]);

  return geo;
}

interface PlateProps {
  x?: number;
  y?: number;
  z?: number;
  width: number;
  height: number;
  radius?: number;
  color?: string; // rgba 或 hex
  renderOrder?: number;
  children?: ReactNode;
}

/** 纯背板（无交互） */
export function Plate({ x = 0, y = 0, z = 0, width, height, radius = 0.012, color = 'rgba(255,255,255,0.12)', renderOrder, children }: PlateProps) {
  const geo = useRoundedRectGeometry(width, height, radius);
  const { color: c, opacity } = parseRGBA(color);
  return (
    <group position={[x, y, z]}>
      <mesh geometry={geo} renderOrder={renderOrder}>
        <meshBasicMaterial color={c} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {children}
    </group>
  );
}

export type BtnVariant = 'primary' | 'ghost' | 'danger' | 'segment';

interface BtnProps {
  x?: number;
  y?: number;
  z?: number;
  width: number;
  height: number;
  radius?: number;
  label?: string;
  fontSize?: number;
  variant?: BtnVariant;
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

interface VariantStyle {
  bg: string;
  bgHover: string;
  bgActive: string;
  bgDisabled: string;
  text: string;
  textActive?: string;
  textDisabled: string;
}

const VARIANTS: Record<BtnVariant, VariantStyle> = {
  primary: {
    bg: 'rgba(0,0,0,0.15)',
    bgHover: 'rgba(0,0,0,0.25)',
    bgActive: 'rgba(0,0,0,0.35)',
    bgDisabled: 'rgba(0,0,0,0.05)',
    text: '#111',
    textDisabled: '#666',
  },
  ghost: {
    bg: 'rgba(0,0,0,0.06)',
    bgHover: 'rgba(0,0,0,0.12)',
    bgActive: 'rgba(0,0,0,0.20)',
    bgDisabled: 'rgba(0,0,0,0.03)',
    text: '#111',
    textDisabled: '#777',
  },
  danger: {
    bg: 'rgba(200,40,40,0.75)',
    bgHover: 'rgba(200,40,40,0.95)',
    bgActive: 'rgba(200,40,40,0.95)',
    bgDisabled: 'rgba(200,40,40,0.20)',
    text: '#fff',
    textDisabled: '#bbb',
  },
  segment: {
    bg: 'rgba(0,0,0,0.05)',
    bgHover: 'rgba(0,0,0,0.15)',
    bgActive: 'rgba(0,0,0,0.7)',
    bgDisabled: 'rgba(0,0,0,0.03)',
    text: '#333',
    textActive: '#fff',
    textDisabled: '#777',
  },
};

export function Btn({
  x = 0,
  y = 0,
  z = 0,
  width,
  height,
  radius = 0.012,
  label,
  fontSize = 0.020,
  variant = 'primary',
  active,
  disabled,
  onPress,
  children,
}: BtnProps) {
  const geo = useRoundedRectGeometry(width, height, radius);
  const [hover, setHover] = useState(false);
  const v = VARIANTS[variant];

  const bg = disabled ? v.bgDisabled : active ? v.bgActive : hover ? v.bgHover : v.bg;
  const textColor = disabled ? v.textDisabled : active && v.textActive ? v.textActive : v.text;
  const { color, opacity } = parseRGBA(bg);

  return (
    <group position={[x, y, z]}>
      <mesh
        geometry={geo}
        onPointerOver={(e) => { e.stopPropagation(); if (!disabled) setHover(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHover(false); }}
        onPointerDown={(e) => { e.stopPropagation(); if (!disabled) onPress?.(); }}
      >
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      {label != null && (
        <Text
          font={FONTS.DEFAULT}
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.0008]}
          fontWeight="bold"
        >
          {label}
        </Text>
      )}
      {children}
    </group>
  );
}

interface LabelProps {
  x?: number;
  y?: number;
  z?: number;
  text: string;
  fontSize?: number;
  color?: string;
  anchorX?: 'left' | 'center' | 'right';
  anchorY?: 'top' | 'middle' | 'bottom';
  maxWidth?: number;
  outline?: boolean;
}

export function Label({
  x = 0,
  y = 0,
  z = 0.0008,
  text,
  fontSize = 0.020,
  color = '#fff',
  anchorX = 'center',
  anchorY = 'middle',
  maxWidth,
  outline = true,
}: LabelProps) {
  return (
    <Text
      font={FONTS.DEFAULT}
      fontSize={fontSize}
      color={color}
      anchorX={anchorX}
      anchorY={anchorY}
      position={[x, y, z]}
      maxWidth={maxWidth}
      outlineWidth={outline ? Math.max(fontSize * 0.025, 0.0003) : 0}
      outlineColor="rgba(0,0,0,0.6)"
    >
      {text}
    </Text>
  );
}
