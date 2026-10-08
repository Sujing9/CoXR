import { useState, type ReactNode } from 'react';
import { Label, Btn } from '../../space/primitives';

interface GridLayoutProps {
  width: number;
  topY: number;
  bottomY: number;
  columns: number;
  cardH: number;
  gap: number;
  itemCount: number;
  renderItem: (
    index: number,
    x: number,
    y: number,
    cardW: number,
    cardH: number,
  ) => ReactNode;
}

/**
 * 简易网格布局：从 topY 向下排列 `itemCount` 个等大卡片。
 *
 * 如果项目过多导致溢出，将自动切分页面，
 * 并在底部渲染 XR 点按翻页控件 (< 上一页 | 1 / N | 下一页 >)。
 */
export function GridLayout({
  width,
  topY,
  bottomY,
  columns,
  cardH,
  gap,
  itemCount,
  renderItem,
}: GridLayoutProps) {
  const [page, setPage] = useState(0);

  const innerH = topY - bottomY;
  const maxRows = Math.max(1, Math.floor((innerH + gap) / (cardH + gap)));
  const cardW = (width - gap * (columns - 1)) / columns;
  const xStart = -width / 2 + cardW / 2;

  const totalRowsNeeded = Math.ceil(itemCount / columns);
  const overflow = totalRowsNeeded > maxRows;
  
  // 如果需要分页，那最后一行的空间留给翻页器
  const visibleRows = overflow ? maxRows - 1 : totalRowsNeeded;
  const itemsPerPage = Math.max(1, visibleRows * columns);
  const totalPages = Math.ceil(itemCount / itemsPerPage);
  
  // 安全限制：防止数据源删除导致的页数越界
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const startIndex = safePage * itemsPerPage;
  const endIndex = Math.min(itemCount, startIndex + itemsPerPage);

  const cells: ReactNode[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    // 基于当前页计算局部网格坐标 row，也就是在当前页是第几行
    const localIndex = i - startIndex;
    const row = Math.floor(localIndex / columns);
    const col = localIndex % columns;
    const x = xStart + col * (cardW + gap);
    const y = topY - cardH / 2 - row * (cardH + gap);
    cells.push(renderItem(i, x, y, cardW, cardH));
  }

  return (
    <group>
      {cells}
      {overflow && (
        <group position={[0, topY - visibleRows * (cardH + gap) - cardH / 2, 0]}>
          <Btn
            x={-0.12}
            y={0}
            width={0.08}
            height={0.04}
            radius={0.02}
            label="上一页"
            fontSize={0.018}
            variant="ghost"
            disabled={safePage === 0}
            onPress={() => setPage(p => Math.max(0, p - 1))}
          />
          <Label
            x={0}
            y={0}
            text={`${safePage + 1} / ${totalPages}`}
            fontSize={0.018}
            color="rgba(0,0,0,0.85)"
          />
          <Btn
            x={0.12}
            y={0}
            width={0.08}
            height={0.04}
            radius={0.02}
            label="下一页"
            fontSize={0.018}
            variant="ghost"
            disabled={safePage >= totalPages - 1}
            onPress={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          />
        </group>
      )}
    </group>
  );
}
