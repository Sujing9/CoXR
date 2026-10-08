import { Btn, Label, Plate } from '../../space/primitives';

interface RayCheckboxProps {
  x?: number;
  y?: number;
  /** 整行宽度（含勾选框 + 标签） */
  width: number;
  /** 行高 */
  height: number;
  checked: boolean;
  label: string;
  /** 标签副文本（小字，可缺省） */
  subtitle?: string;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}

/**
 * 射线友好的勾选框：
 * - 左侧 一个方形勾选框（20×20mm）
 * - 右侧 标签（可选副标题）
 * - 整行可点（命中标签也能切换）
 */
export function RayCheckbox({
  x = 0,
  y = 0,
  width,
  height,
  checked,
  label,
  subtitle,
  disabled,
  onChange,
}: RayCheckboxProps) {
  const BOX = 0.020;
  const boxCX = -width / 2 + 0.012 + BOX / 2;
  const labelLX = boxCX + BOX / 2 + 0.010;
  const labelMaxW = width / 2 - labelLX - 0.010 + (width / 2);

  return (
    <group position={[x, y, 0]}>
      {/* 整行命中按钮（变体 ghost，自带 hover/active） */}
      <Btn
        x={0}
        y={0}
        width={width}
        height={height}
        radius={0.010}
        variant="ghost"
        disabled={disabled}
        onPress={() => onChange?.(!checked)}
      />
      {/* 勾选框 */}
      <group position={[boxCX, 0, 0.0008]}>
        <Plate
          width={BOX}
          height={BOX}
          radius={0.004}
          color={
            disabled
              ? 'rgba(0,0,0,0.10)'
              : checked
                ? 'rgba(40,120,60,1)'
                : 'rgba(0,0,0,0.15)'
          }
        />
        {checked && (
          <Label
            text="✓"
            fontSize={0.016}
            color="#fff"
            outline={false}
          />
        )}
      </group>
      {/* 标签 */}
      <Label
        x={labelLX}
        y={subtitle ? 0.005 : 0}
        text={label}
        fontSize={0.018}
        color={disabled ? 'rgba(0,0,0,0.35)' : '#000'}
        anchorX="left"
        maxWidth={labelMaxW}
      />
      {subtitle && (
        <Label
          x={labelLX}
          y={-0.010}
          text={subtitle}
          fontSize={0.013}
          color="rgba(0,0,0,0.65)"
          anchorX="left"
          maxWidth={labelMaxW}
        />
      )}
    </group>
  );
}
