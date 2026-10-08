import { useCallback, useState } from 'react';
import { useSpaceStore } from '@/data/spaceStore';
import { SpaceListView } from './SpaceListView';
import { SpaceDetailView } from './SpaceDetailView';
import { StatusBar, type StatusKind, type StatusMsg } from './StatusBar';

interface SpaceTabProps {
  /** 内容区可用宽（米） */
  width: number;
  /** 内容区可用高（米） */
  height: number;
}

const STATUS_BAR_H = 0.044;

export function SpaceTab({ width, height }: SpaceTabProps) {
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  const [status, setStatus] = useState<StatusMsg | null>(null);

  const pushStatus = useCallback((kind: StatusKind, text: string) => {
    setStatus({ kind, text, nonce: performance.now() });
  }, []);
  const clearStatus = useCallback(() => setStatus(null), []);

  // 状态条为浮层（z=+0.003），不占布局。body 始终按完整 height 渲染。
  const statusY = height / 2 - STATUS_BAR_H / 2;

  return (
    <group>
      {activeSpace && activeSpace.id ? (
        <SpaceDetailView space={activeSpace} width={width} height={height} pushStatus={pushStatus} />
      ) : (
        <SpaceListView width={width} height={height} pushStatus={pushStatus} />
      )}
      <StatusBar status={status} onClear={clearStatus} width={width} y={statusY} />
    </group>
  );
}
