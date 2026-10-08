import { useEffect, useState } from 'react';
import { Btn, Label, Plate } from './primitives';
import { NumPad } from './NumPad';
import { useSpaceStore } from '@/data/spaceStore';
import { spacesApi, type SpaceInfo } from '@/api/spaces';
import type { StatusKind } from './StatusBar';

const ROLE_LABEL: Record<number, string> = { 0: '成员', 1: '管理员', 2: '所有者' };

interface SpaceListViewProps {
  width: number;
  height: number;
  centerY?: number;
  pushStatus: (kind: StatusKind, text: string) => void;
}

type SubMode = 'list' | 'create' | 'join';

const SEG_H = 0.052;
const ROW_H = 0.072;
const ROW_GAP = 0.010;

export function SpaceListView({ width, height, centerY = 0, pushStatus }: SpaceListViewProps) {
  const [mode, setMode] = useState<SubMode>('list');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const spaces = useSpaceStore((s) => s.spaces);
  const pendingSpaces = useSpaceStore((s) => s.pendingSpaces);
  const isLoading = useSpaceStore((s) => s.isLoading);
  const fetchMySpaces = useSpaceStore((s) => s.fetchMySpaces);
  const setActiveSpace = useSpaceStore((s) => s.setActiveSpace);
  const addSpace = useSpaceStore((s) => s.addSpace);
  const addPendingSpace = useSpaceStore((s) => s.addPendingSpace);
  const removeSpace = useSpaceStore((s) => s.removeSpace);

  // 进入面板首次加载（list 切换时静默刷新）
  useEffect(() => {
    fetchMySpaces();
  }, [fetchMySpaces, mode]);

  const handleSelect = (s: SpaceInfo) => {
    setActiveSpace(s);
    pushStatus('success', `已进入空间 ${s.accessCode}`);
  };

  const handleCreate = async () => {
    setBusy(true);
    try {
      const { space } = await spacesApi.create();
      addSpace(space);
      setActiveSpace(space);
      pushStatus('success', `空间已创建：${space.accessCode}`);
    } catch (e) {
      pushStatus('error', `创建失败：${(e as Error).message ?? ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 4) return;
    setBusy(true);
    try {
      const res = await spacesApi.join(joinCode);
      if (res.alreadyMember || res.joined) {
        addSpace(res.space);
        setActiveSpace(res.space);
        pushStatus('success', res.alreadyMember ? '已在该空间中' : '成功加入空间');
      } else {
        addPendingSpace({ ...res.space, memberStatus: 0 });
        pushStatus('info', '申请已提交，等待审批');
      }
      setJoinCode('');
      setMode('list');
    } catch (e) {
      pushStatus('error', `加入失败：${(e as Error).message ?? ''}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (s: SpaceInfo) => {
    setBusy(true);
    try {
      await spacesApi.delete(s.id);
      removeSpace(s.id);
      setConfirmDeleteId(null);
      pushStatus('success', s.myRole === 2 ? `已解散空间 ${s.accessCode}` : `已退出空间 ${s.accessCode}`);
    } catch (e) {
      pushStatus('error', `操作失败：${(e as Error).message ?? ''}`);
    } finally {
      setBusy(false);
    }
  };

  // ── 顶部 segmented control ───────────────────────────────────────────────
  const segGap = 0.008;
  const segW = (width - segGap * 2) / 3;
  const segY = height / 2 - SEG_H / 2;
  const segments: Array<{ key: SubMode; label: string }> = [
    { key: 'list', label: '我的空间' },
    { key: 'create', label: '新建' },
    { key: 'join', label: '加入' },
  ];

  const bodyTop = segY - SEG_H / 2 - 0.014;
  const bodyBottom = -height / 2;
  const bodyH = bodyTop - bodyBottom;
  const bodyCY = (bodyTop + bodyBottom) / 2;

  return (
    <group position={[0, centerY, 0]}>
      {/* segmented control */}
      {segments.map((s, i) => (
        <Btn
          key={s.key}
          x={-width / 2 + segW / 2 + i * (segW + segGap)}
          y={segY}
          width={segW}
          height={SEG_H}
          radius={0.012}
          label={s.label}
          fontSize={0.020}
          variant="segment"
          active={mode === s.key}
          onPress={() => setMode(s.key)}
        />
      ))}

      {/* body */}
      {mode === 'list' && (
        <ListBody
          x={0}
          y={bodyCY}
          width={width}
          height={bodyH}
          spaces={spaces}
          pendingSpaces={pendingSpaces}
          isLoading={isLoading}
          confirmDeleteId={confirmDeleteId}
          busy={busy}
          onSelect={handleSelect}
          onRequestDelete={(id) => setConfirmDeleteId(id)}
          onCancelDelete={() => setConfirmDeleteId(null)}
          onConfirmDelete={handleDelete}
          onGoCreate={() => setMode('create')}
          onGoJoin={() => setMode('join')}
        />
      )}

      {mode === 'create' && (
        <CreateBody x={0} y={bodyCY} width={width} height={bodyH} busy={busy} onCreate={handleCreate} />
      )}

      {mode === 'join' && (
        <NumPad
          x={0}
          y={bodyCY}
          width={Math.min(width, 0.42)}
          height={Math.min(bodyH, 0.40)}
          value={joinCode}
          onChange={setJoinCode}
          onSubmit={handleJoin}
          submitDisabled={joinCode.length !== 4 || busy}
          submitLabel={busy ? '加入中…' : '加入'}
          hint="请输入 4 位访问码"
        />
      )}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface ListBodyProps {
  x: number;
  y: number;
  width: number;
  height: number;
  spaces: SpaceInfo[];
  pendingSpaces: SpaceInfo[];
  isLoading: boolean;
  confirmDeleteId: string | null;
  busy: boolean;
  onSelect: (s: SpaceInfo) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (s: SpaceInfo) => void;
  onGoCreate: () => void;
  onGoJoin: () => void;
}

function ListBody(p: ListBodyProps) {
  const { width, height, spaces, pendingSpaces, isLoading, confirmDeleteId, onSelect, onRequestDelete, onCancelDelete, onConfirmDelete, onGoCreate, onGoJoin } = p;

  if (isLoading) {
    return (
      <group position={[p.x, p.y, 0]}>
        <Label x={0} y={0} text="加载中…" fontSize={0.022} color="#000" />
      </group>
    );
  }

  if (spaces.length === 0 && pendingSpaces.length === 0) {
    return (
      <group position={[p.x, p.y, 0]}>
        <Label x={0} y={0.040} text="还没有加入任何空间" fontSize={0.024} color="#000" />
        <Btn x={-0.082} y={-0.026} width={0.150} height={0.054} label="新建空间" fontSize={0.020} variant="primary" onPress={onGoCreate} />
        <Btn x={0.082} y={-0.026} width={0.150} height={0.054} label="加入空间" fontSize={0.020} variant="ghost" onPress={onGoJoin} />
      </group>
    );
  }

  // 自顶向下铺：每行 ROW_H + ROW_GAP；删除确认行展开为额外 0.060 高的二级区
  const rows: Array<{ kind: 'space' | 'pending' | 'header'; data?: SpaceInfo; expanded?: boolean; text?: string }> = [];

  for (const s of spaces) {
    rows.push({ kind: 'space', data: s, expanded: confirmDeleteId === s.id });
  }
  if (pendingSpaces.length > 0) {
    if (spaces.length > 0) rows.push({ kind: 'header', text: '申请记录' });
    for (const ps of pendingSpaces) rows.push({ kind: 'pending', data: ps });
  }

  // 计算每行 yOffset
  let yCursor = height / 2;
  const placed: Array<{ row: typeof rows[number]; y: number; h: number }> = [];
  const HEADER_H = 0.024;
  const EXPAND_H = 0.058;
  for (const row of rows) {
    let h = ROW_H;
    if (row.kind === 'header') h = HEADER_H;
    if (row.kind === 'space' && row.expanded) h = ROW_H + EXPAND_H + 0.004;
    yCursor -= h / 2;
    placed.push({ row, y: yCursor, h });
    yCursor -= h / 2 + ROW_GAP;
    if (yCursor < -height / 2) break;
  }

  return (
    <group position={[p.x, p.y, 0]}>
      {placed.map((r, i) => {
        if (r.row.kind === 'header') {
          return (
            <Label
              key={i}
              x={-width / 2 + 0.006}
              y={r.y}
              text={r.row.text!}
              fontSize={0.016}
              color="#333"
              anchorX="left"
            />
          );
        }
        if (r.row.kind === 'pending') {
          const s = r.row.data!;
          const approved = (s.memberStatus ?? 0) === 1;
          return (
            <PendingRow
              key={s.id}
              x={0}
              y={r.y}
              width={width}
              height={ROW_H}
              space={s}
              approved={approved}
              onEnter={() => approved && onSelect(s)}
            />
          );
        }
        // space row
        const s = r.row.data!;
        return (
          <SpaceRow
            key={s.id}
            x={0}
            y={r.y}
            width={width}
            height={r.h}
            space={s}
            expanded={!!r.row.expanded}
            onSelect={() => onSelect(s)}
            onRequestDelete={() => onRequestDelete(s.id)}
            onCancelDelete={onCancelDelete}
            onConfirmDelete={() => onConfirmDelete(s)}
          />
        );
      })}
    </group>
  );
}

// ── SpaceRow ─────────────────────────────────────────────────────────────────

interface SpaceRowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  space: SpaceInfo;
  expanded: boolean;
  onSelect: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SpaceRow({ width, height, space, expanded, onSelect, onRequestDelete, onCancelDelete, onConfirmDelete, ...pos }: SpaceRowProps) {
  const topH = ROW_H;
  const topY = expanded ? height / 2 - topH / 2 : 0;
  const isOwner = space.myRole === 2;

  return (
    <group position={[pos.x, pos.y, 0]}>
      <Plate width={width} height={height} radius={0.012} color="rgba(0,0,0,0.04)" />

      {/* 主行：左侧大按钮（点击进入） + 右侧删除按钮 */}
      <group position={[0, topY, 0.0008]}>
        <Btn
          x={-width / 2 + (width - 0.080) / 2 + 0.004}
          y={0}
          width={width - 0.080 - 0.008}
          height={topH - 0.010}
          radius={0.010}
          variant="ghost"
          onPress={onSelect}
        >
          <Label x={-(width - 0.080 - 0.008) / 2 + 0.014} y={0.012} text={`空间 ${space.accessCode}`} fontSize={0.024} color="#000" anchorX="left" />
          <Label x={-(width - 0.080 - 0.008) / 2 + 0.014} y={-0.014} text={`角色：${ROLE_LABEL[space.myRole ?? 0] ?? '成员'}`} fontSize={0.016} color="#444" anchorX="left" />
          <Label x={(width - 0.080 - 0.008) / 2 - 0.018} y={0} text="进入 ›" fontSize={0.018} color="#000" anchorX="right" />
        </Btn>
        <Btn
          x={width / 2 - 0.040 - 0.004}
          y={0}
          width={0.072}
          height={topH - 0.010}
          radius={0.010}
          label="删除"
          fontSize={0.018}
          variant="danger"
          onPress={onRequestDelete}
        />
      </group>

      {/* 二次确认展开区 */}
      {expanded && (
        <group position={[0, -height / 2 + (height - topH) / 2, 0.0010]}>
          <Plate width={width - 0.012} height={(height - topH) - 0.008} radius={0.010} color="rgba(200,40,40,0.12)" />
          <Label
            x={-width / 2 + 0.014}
            y={0.014}
            text={isOwner ? `解散空间 ${space.accessCode}？此操作无法恢复。` : `退出空间 ${space.accessCode}？`}
            fontSize={0.018}
            color="#000"
            anchorX="left"
            maxWidth={width - 0.180}
          />
          <Btn
            x={width / 2 - 0.040 - 0.080 - 0.008}
            y={-0.012}
            width={0.080}
            height={0.034}
            radius={0.008}
            label="取消"
            fontSize={0.016}
            variant="ghost"
            onPress={onCancelDelete}
          />
          <Btn
            x={width / 2 - 0.040 - 0.004}
            y={-0.012}
            width={0.080}
            height={0.034}
            radius={0.008}
            label={isOwner ? '确认解散' : '确认退出'}
            fontSize={0.016}
            variant="danger"
            onPress={onConfirmDelete}
          />
        </group>
      )}
    </group>
  );
}

// ── PendingRow ───────────────────────────────────────────────────────────────

interface PendingRowProps {
  x: number;
  y: number;
  width: number;
  height: number;
  space: SpaceInfo;
  approved: boolean;
  onEnter: () => void;
}

function PendingRow({ width, height, space, approved, onEnter, ...pos }: PendingRowProps) {
  return (
    <group position={[pos.x, pos.y, 0]}>
      <Plate width={width} height={height} radius={0.012} color={approved ? 'rgba(60,160,90,0.12)' : 'rgba(220,170,60,0.12)'} />
      <Label x={-width / 2 + 0.014} y={0.012} text={`空间 ${space.accessCode}`} fontSize={0.022} color="#000" anchorX="left" />
      <Label x={-width / 2 + 0.014} y={-0.014} text={approved ? '已批准 · 点击进入即可加入' : '审批中 · 等待管理员处理'} fontSize={0.015} color="#444" anchorX="left" />
      {approved && (
        <Btn
          x={width / 2 - 0.040 - 0.004}
          y={0}
          width={0.072}
          height={height - 0.018}
          radius={0.008}
          label="进入"
          fontSize={0.018}
          variant="primary"
          onPress={onEnter}
        />
      )}
    </group>
  );
}

// ── CreateBody ───────────────────────────────────────────────────────────────

interface CreateBodyProps {
  x: number;
  y: number;
  width: number;
  height: number;
  busy: boolean;
  onCreate: () => void;
}

function CreateBody({ x, y, busy, onCreate }: CreateBodyProps) {
  return (
    <group position={[x, y, 0]}>
      <Label x={0} y={0.060} text="创建新的协作空间" fontSize={0.026} color="#000" />
      <Label x={0} y={0.020} text="系统将自动生成 4 位访问码" fontSize={0.018} color="#333" maxWidth={0.40} />
      <Label x={0} y={-0.002} text="分享给协作者即可邀请加入" fontSize={0.018} color="#333" maxWidth={0.40} />
      <Btn
        x={0}
        y={-0.058}
        width={0.220}
        height={0.062}
        radius={0.014}
        label={busy ? '创建中…' : '立即创建'}
        fontSize={0.022}
        variant="primary"
        disabled={busy}
        onPress={onCreate}
      />
    </group>
  );
}
