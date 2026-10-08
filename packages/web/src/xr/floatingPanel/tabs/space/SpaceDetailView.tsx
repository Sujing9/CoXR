import { useState } from 'react';
import { Btn, Label, Plate } from './primitives';
import { useSpaceStore } from '@/data/spaceStore';
import { spacesApi, type SpaceInfo } from '@/api/spaces';
import type { StatusKind } from './StatusBar';

const ROLE_LABEL: Record<number, string> = { 0: '成员', 1: '管理员', 2: '所有者' };
const STATUS_LABEL: Record<number, string> = { 0: '开放', 1: '申请制', 2: '关闭' };

interface SpaceDetailViewProps {
  space: SpaceInfo;
  width: number;
  height: number;
  pushStatus: (kind: StatusKind, text: string) => void;
}

export function SpaceDetailView({ space, width, height, pushStatus }: SpaceDetailViewProps) {
  const clearActiveSpace = useSpaceStore((s) => s.clearActiveSpace);
  const updateActiveSpace = useSpaceStore((s) => s.updateActiveSpace);
  const [updating, setUpdating] = useState(false);

  const isAdmin = (space.myRole ?? 0) >= 1;

  const handleStatusChange = async (newStatus: number) => {
    if (newStatus === space.status) return;
    setUpdating(true);
    try {
      await spacesApi.updateSpaceStatus(space.id, newStatus);
      updateActiveSpace({ status: newStatus });
      pushStatus('success', '空间状态已更新');
    } catch (e) {
      pushStatus('error', `更新失败：${(e as Error).message ?? ''}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleLeave = () => {
    clearActiveSpace();
    pushStatus('info', `已退出空间 ${space.accessCode}`);
  };

  const formattedDate = new Date(space.createdAt).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });

  // 上：访问码大字块（卡片）
  const codeBlockH = 0.110;
  const codeBlockY = height / 2 - codeBlockH / 2;

  // 中：信息卡片（4 行）
  const infoRowH = 0.034;
  const infoRows = 4;
  const infoBlockH = infoRowH * infoRows + 0.020;
  const infoBlockY = codeBlockY - codeBlockH / 2 - 0.014 - infoBlockH / 2;

  // 状态切换（仅管理员）
  const statusBlockH = isAdmin ? 0.080 : 0;
  const statusBlockY = infoBlockY - infoBlockH / 2 - 0.014 - statusBlockH / 2;

  // 退出按钮
  const leaveBtnY = (isAdmin ? statusBlockY - statusBlockH / 2 : infoBlockY - infoBlockH / 2) - 0.014 - 0.030;

  return (
    <group>
      {/* 访问码 */}
      <group position={[0, codeBlockY, 0]}>
        <Plate width={width} height={codeBlockH} radius={0.014} color="rgba(80,100,180,0.12)" />
        <Label x={-width / 2 + 0.018} y={codeBlockH / 2 - 0.020} text="访问码" fontSize={0.016} color="#333" anchorX="left" />
        <Label x={0} y={-0.008} text={space.accessCode} fontSize={0.076} color="#000" outline={false} />
      </group>

      {/* 信息行 */}
      <group position={[0, infoBlockY, 0]}>
        <Plate width={width} height={infoBlockH} radius={0.012} color="rgba(0,0,0,0.04)" />
        {[
          { label: '我的角色', value: ROLE_LABEL[space.myRole ?? 0] ?? '成员' },
          { label: '空间状态', value: STATUS_LABEL[space.status] ?? '未知' },
          { label: '创建时间', value: formattedDate },
          { label: '空间 ID', value: `${space.id.slice(0, 8)}…` },
        ].map((row, i) => {
          const cy = infoBlockH / 2 - 0.010 - infoRowH / 2 - i * infoRowH;
          return (
            <group key={i} position={[0, cy, 0.0008]}>
              <Label x={-width / 2 + 0.018} y={0} text={row.label} fontSize={0.017} color="#444" anchorX="left" />
              <Label x={width / 2 - 0.018} y={0} text={row.value} fontSize={0.018} color="#000" anchorX="right" />
            </group>
          );
        })}
      </group>

      {/* 状态切换（管理员） */}
      {isAdmin && (
        <group position={[0, statusBlockY, 0]}>
          <Plate width={width} height={statusBlockH} radius={0.012} color="rgba(0,0,0,0.04)" />
          <Label x={-width / 2 + 0.018} y={statusBlockH / 2 - 0.014} text="切换空间状态" fontSize={0.016} color="#444" anchorX="left" />
          {(() => {
            const opts: Array<{ value: number; label: string }> = [
              { value: 0, label: '开放' },
              { value: 1, label: '申请制' },
              { value: 2, label: '关闭' },
            ];
            const gap = 0.010;
            const innerW = width - 0.024 - 0.024;
            const btnW = (innerW - gap * (opts.length - 1)) / opts.length;
            return opts.map((o, i) => (
              <Btn
                key={o.value}
                x={-width / 2 + 0.024 + btnW / 2 + i * (btnW + gap)}
                y={-statusBlockH / 2 + 0.024}
                width={btnW}
                height={0.034}
                radius={0.008}
                label={o.label}
                fontSize={0.015}
                variant="segment"
                active={space.status === o.value}
                disabled={updating}
                onPress={() => handleStatusChange(o.value)}
              />
            ));
          })()}
        </group>
      )}

      {/* 退出 */}
      <Btn
        x={0}
        y={leaveBtnY}
        width={Math.min(width, 0.32)}
        height={0.052}
        radius={0.012}
        label="退出当前空间"
        fontSize={0.02}
        variant="ghost"
        onPress={handleLeave}
      />
    </group>
  );
}
