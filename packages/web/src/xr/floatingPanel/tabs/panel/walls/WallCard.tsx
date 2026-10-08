import { useState } from 'react';
import { Btn, Label, Plate } from '../../space/primitives';

interface WallCardProps {
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** 主标题（中文/英文） */
  title: string;
  /** 副标题（小字，可缺省） */
  subtitle?: string;
  /** 右上角徽章数字（可缺省） */
  badge?: string | number;
  /** 主色调（hex / rgba）；用于左侧色条 + 标题色 */
  accent?: string;
  disabled?: boolean;
  onPress?: () => void;
  titleFontSize?: number;
  subtitleFontSize?: number;
  badgeFontSize?: number;
}

/**
 * 卡片墙通用大卡：
 * - 左侧 4mm 宽色条（accent）
 * - 主标题 + 副标题
 * - 右上小徽章（计数）
 *
 * 整张卡是按钮（射线点击触发 `onPress`）。
 */
export function WallCard({
  x = 0,
  y = 0,
  width,
  height,
  title,
  subtitle,
  badge,
  accent = 'rgba(0,0,0,0.40)',
  disabled,
  onPress,
  titleFontSize = 0.034,
  subtitleFontSize = 0.024,
  badgeFontSize = 0.024,
}: WallCardProps) {
  const [hover, setHover] = useState(false);
  const innerLX = -width / 2 + 0.020;

  return (
    <group position={[x, y, 0]}>
      {/* 卡片底（按钮层） */}
      <Btn
        x={0}
        y={0}
        width={width}
        height={height}
        radius={0.014}
        variant="ghost"
        disabled={disabled}
        onPress={onPress}
      />

      {/* 左侧 accent 色条（仅装饰，不挡射线） */}
      <Plate
        x={-width / 2 + 0.006}
        y={0}
        width={0.004}
        height={height - 0.012}
        radius={0.002}
        color={accent}
      />

      {/* 主标题 */}
      <Label
        x={innerLX}
        y={subtitle ? height * 0.18 : 0}
        text={title}
        fontSize={titleFontSize}
        color="#000"
        anchorX="left"
        maxWidth={width - 0.040}
      />

      {/* 副标题 */}
      {subtitle && (
        <Label
          x={innerLX}
          y={-height * 0.10}
          text={subtitle}
          fontSize={subtitleFontSize}
          color="rgba(0,0,0,0.75)"
          anchorX="left"
          maxWidth={width - 0.040}
        />
      )}

      {/* 徽章 */}
      {badge != null && String(badge).length > 0 && (
        <group position={[width / 2 - 0.022, height / 2 - 0.018, 0.0005]}>
          <Plate
            width={0.034}
            height={0.020}
            radius={0.010}
            color="rgba(0,0,0,0.15)"
          />
          <Label text={String(badge)} fontSize={badgeFontSize} color="#000" />
        </group>
      )}

      {/* 不直接消耗 hover 状态以避免 react warn；保留 setHover 以便将来加 hover 视效 */}
      <group visible={hover && !disabled} />
    </group>
  );
}
