import { Btn, Label, Plate } from './primitives';

interface NumPadProps {
  /** 当前已输入的数字字符串（≤ maxLength 位） */
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** 中心 x（content 区域局部） */
  x: number;
  y: number;
  width: number;
  /** 总高（包含显示区 + 键盘区） */
  height: number;
  maxLength?: number;
  submitDisabled?: boolean;
  submitLabel?: string;
  hint?: string;
}

const KEY_RADIUS = 0.014;
const SLOT_SIZE = 0.075;
const SLOT_GAP = 0.018;

export function NumPad({
  value,
  onChange,
  onSubmit,
  x,
  y,
  width,
  height,
  maxLength = 4,
  submitDisabled,
  submitLabel = '确认',
  hint = '请输入访问码',
}: NumPadProps) {
  // 4 个数字槽：等宽
  const slotW = SLOT_SIZE;
  const slotsTotalW = slotW * maxLength + SLOT_GAP * (maxLength - 1);
  const slotsStartX = -slotsTotalW / 2 + slotW / 2;
  const slotsY = height / 2 - SLOT_SIZE / 2 - 0.006;

  // 键盘 4 行 × 3 列
  const padTop = slotsY - SLOT_SIZE / 2 - 0.026;
  const keyAreaH = padTop - (-height / 2);
  const rows = 4;
  const cols = 3;
  const keyGap = 0.012;
  const keyW = (width - keyGap * (cols - 1)) / cols;
  const keyH = (keyAreaH - keyGap * (rows - 1)) / rows;
  const keyStartY = padTop - keyH / 2;
  const keyStartX = -width / 2 + keyW / 2;

  const press = (ch: string) => {
    if (value.length < maxLength) onChange(value + ch);
  };
  const back = () => {
    if (value.length > 0) onChange(value.slice(0, -1));
  };

  const keys: Array<{ row: number; col: number; label: string; onPress: () => void; variant?: 'ghost' | 'primary' | 'danger' }> = [];
  // 1-9
  for (let i = 0; i < 9; i++) {
    const n = i + 1;
    keys.push({
      row: Math.floor(i / 3),
      col: i % 3,
      label: String(n),
      onPress: () => press(String(n)),
      variant: 'ghost',
    });
  }
  // 第 4 行：⌫ / 0 / ✓
  keys.push({ row: 3, col: 0, label: '⌫', onPress: back, variant: 'ghost' });
  keys.push({ row: 3, col: 1, label: '0', onPress: () => press('0'), variant: 'ghost' });
  keys.push({
    row: 3,
    col: 2,
    label: submitLabel,
    onPress: () => { if (!submitDisabled) onSubmit(); },
    variant: 'primary',
  });

  return (
    <group position={[x, y, 0]}>
      {/* 提示 */}
      <Label x={0} y={height / 2 + 0.022} text={hint} fontSize={0.019} color="#333" />

      {/* 输入槽 */}
      {Array.from({ length: maxLength }).map((_, i) => {
        const ch = value[i] ?? '';
        return (
          <Plate
            key={i}
            x={slotsStartX + i * (slotW + SLOT_GAP)}
            y={slotsY}
            width={slotW}
            height={SLOT_SIZE}
            radius={0.010}
            color={ch ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.06)'}
          >
            {ch && <Label x={0} y={0} z={0.0008} text={ch} fontSize={0.045} color="#000" outline={false} />}
          </Plate>
        );
      })}

      {/* 键盘 */}
      {keys.map((k, idx) => {
        const cx = keyStartX + k.col * (keyW + keyGap);
        const cy = keyStartY - k.row * (keyH + keyGap);
        const isSubmit = k.variant === 'primary';
        return (
          <Btn
            key={idx}
            x={cx}
            y={cy}
            width={keyW}
            height={keyH}
            radius={KEY_RADIUS}
            label={k.label}
            fontSize={isSubmit ? 0.022 : 0.026}
            variant={k.variant ?? 'ghost'}
            disabled={isSubmit ? submitDisabled : false}
            onPress={k.onPress}
          />
        );
      })}
    </group>
  );
}
