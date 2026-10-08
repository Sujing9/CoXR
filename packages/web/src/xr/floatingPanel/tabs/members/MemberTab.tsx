import { useCallback, useEffect, useState } from 'react';
import { useSpaceStore } from '@/data/spaceStore';
import { useAuthStore } from '@/data/authStore';
import { useSpaceUIStore } from '@/data/spaceUIStore';
import { spacesApi, type SpaceMember, type SpaceApplication, type RemovedMember } from '@/api/spaces';
import { Plate, Btn, Label } from '../space/primitives';
import { StatusBar, type StatusKind, type StatusMsg } from '../space/StatusBar';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<number, string> = { 0: '成员', 1: '管理员', 2: '所有者' };

const PAGE_SIZE = 5;
const ROW_H = 0.054;
const ROW_GAP = 0.007;
const SEG_H = 0.044;
const STATUS_BAR_H = 0.044;
const PAGE_BTN_H = 0.040;
const AVATAR_R = 0.018;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatShortDate(iso: string | null, label: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${label} ${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Row: Member ──────────────────────────────────────────────────────────────

function MemberRow({
  member,
  width,
  myRole,
  myUserId,
  onKick,
}: {
  member: SpaceMember;
  width: number;
  myRole: number;
  myUserId: string;
  onKick: () => void;
}) {
  const isSelf = member.userId === myUserId;
  const canKick = !isSelf && myRole >= 1 && member.memberRole < myRole;

  const avatarCX = -width / 2 + 0.012 + AVATAR_R;
  const KICK_BTN_W = 0.056;
  const actionCX = width / 2 - 0.012 - KICK_BTN_W / 2;
  const nameLX = avatarCX + AVATAR_R + 0.010;
  const nameRX = canKick ? actionCX - KICK_BTN_W / 2 - 0.008 : width / 2 - 0.014;
  const nameMaxW = nameRX - nameLX;

  const timeStr = member.lastJoinedAt
    ? formatShortDate(member.lastJoinedAt, '加入')
    : formatShortDate(member.lastLeftAt, '离开');
  const hasTime = timeStr.length > 0;

  const nameY = hasTime ? ROW_H * 0.15 : 0;
  const subY = hasTime ? -ROW_H * 0.20 : -ROW_H * 0.13;
  const roleStr = (isSelf ? '我 · ' : '') + (ROLE_LABEL[member.memberRole] ?? '成员');

  return (
    <group>
      {/* Background */}
      <Plate width={width} height={ROW_H} radius={0.010} color="rgba(0,0,0,0.04)" />

      {/* Content layer (z-offset in front of background) */}
      <group position={[0, 0, 0.001]}>
        {/* Avatar circle */}
        <Plate
          x={avatarCX}
          width={AVATAR_R * 2}
          height={AVATAR_R * 2}
          radius={AVATAR_R}
          color={isSelf ? 'rgba(80,130,220,0.15)' : 'rgba(0,0,0,0.08)'}
        >
          <Label
            text={member.nickname.charAt(0).toUpperCase()}
            fontSize={AVATAR_R * 0.9}
            color={isSelf ? '#2b58b4' : '#111'}
            outline={false}
          />
        </Plate>

        {/* Nickname */}
        <Label
          x={nameLX}
          y={nameY}
          text={member.nickname}
          fontSize={0.02}
          color="#000"
          anchorX="left"
          maxWidth={nameMaxW}
        />

        {/* Role */}
        <Label
          x={nameLX}
          y={subY}
          text={roleStr}
          fontSize={0.014}
          color="#333"
          anchorX="left"
        />

        {/* Time (right-aligned, only when there's a time) */}
        {hasTime && (
          <Label
            x={nameRX}
            y={subY}
            text={timeStr}
            fontSize={0.013}
            color="#444"
            anchorX="right"
          />
        )}

        {/* Kick button */}
        {canKick && (
          <Btn
            x={actionCX}
            width={KICK_BTN_W}
            height={0.034}
            radius={0.008}
            label="踢出"
            fontSize={0.014}
            variant="danger"
            onPress={onKick}
          />
        )}
      </group>
    </group>
  );
}

// ─── Row: Application ─────────────────────────────────────────────────────────

function ApplicationRow({
  app,
  width,
  onApprove,
  onReject,
}: {
  app: SpaceApplication;
  width: number;
  onApprove: () => void;
  onReject: () => void;
}) {
  const avatarCX = -width / 2 + 0.012 + AVATAR_R;
  const nameLX = avatarCX + AVATAR_R + 0.010;

  const BTN_W = 0.052;
  const BTN_GAP = 0.006;
  const rejectCX = width / 2 - 0.012 - BTN_W / 2;
  const approveCX = rejectCX - BTN_W - BTN_GAP;
  const nameRX = approveCX - BTN_W / 2 - 0.008;
  const nameMaxW = nameRX - nameLX;

  const timeStr = formatShortDate(app.createdAt, '申请于');

  return (
    <group>
      <Plate width={width} height={ROW_H} radius={0.010} color="rgba(0,0,0,0.04)" />

      <group position={[0, 0, 0.001]}>
        {/* Avatar */}
        <Plate
          x={avatarCX}
          width={AVATAR_R * 2}
          height={AVATAR_R * 2}
          radius={AVATAR_R}
          color="rgba(0,0,0,0.08)"
        >
          <Label
            text={app.nickname.charAt(0).toUpperCase()}
            fontSize={AVATAR_R * 0.9}
            color="#111"
            outline={false}
          />
        </Plate>

        {/* Nickname */}
        <Label
          x={nameLX}
          y={timeStr ? ROW_H * 0.15 : 0}
          text={app.nickname}
          fontSize={0.02}
          color="#000"
          anchorX="left"
          maxWidth={nameMaxW}
        />

        {/* Time */}
        {timeStr && (
          <Label
            x={nameLX}
            y={-ROW_H * 0.20}
            text={timeStr}
            fontSize={0.013}
            color="#444"
            anchorX="left"
          />
        )}

        {/* Approve */}
        <Btn
          x={approveCX}
          width={BTN_W}
          height={0.034}
          radius={0.008}
          label="通过"
          fontSize={0.013}
          variant="ghost"
          onPress={onApprove}
        />

        {/* Reject */}
        <Btn
          x={rejectCX}
          width={BTN_W}
          height={0.034}
          radius={0.008}
          label="拒绝"
          fontSize={0.013}
          variant="danger"
          onPress={onReject}
        />
      </group>
    </group>
  );
}

// ─── Row: Removed ─────────────────────────────────────────────────────────────

function RemovedRow({
  member,
  width,
  onUnkick,
}: {
  member: RemovedMember;
  width: number;
  onUnkick: () => void;
}) {
  const avatarCX = -width / 2 + 0.012 + AVATAR_R;
  const nameLX = avatarCX + AVATAR_R + 0.010;

  const BTN_W = 0.068;
  const unkickCX = width / 2 - 0.012 - BTN_W / 2;
  const nameRX = unkickCX - BTN_W / 2 - 0.008;
  const nameMaxW = nameRX - nameLX;

  const timeStr = formatShortDate(member.updatedAt, '移出于');

  return (
    <group>
      <Plate width={width} height={ROW_H} radius={0.010} color="rgba(200,40,40,0.06)" />

      <group position={[0, 0, 0.001]}>
        {/* Avatar (red tint) */}
        <Plate
          x={avatarCX}
          width={AVATAR_R * 2}
          height={AVATAR_R * 2}
          radius={AVATAR_R}
          color="rgba(200,40,40,0.15)"
        >
          <Label
            text={member.nickname.charAt(0).toUpperCase()}
            fontSize={AVATAR_R * 0.9}
            color="#a02828"
            outline={false}
          />
        </Plate>

        {/* Nickname */}
        <Label
          x={nameLX}
          y={timeStr ? ROW_H * 0.15 : 0}
          text={member.nickname}
          fontSize={0.02}
          color="#333"
          anchorX="left"
          maxWidth={nameMaxW}
        />

        {/* Time */}
        {timeStr && (
          <Label
            x={nameLX}
            y={-ROW_H * 0.20}
            text={timeStr}
            fontSize={0.013}
            color="#555"
            anchorX="left"
          />
        )}

        {/* Unkick */}
        <Btn
          x={unkickCX}
          width={BTN_W}
          height={0.034}
          radius={0.008}
          label="解除移出"
          fontSize={0.013}
          variant="ghost"
          onPress={onUnkick}
        />
      </group>
    </group>
  );
}

// ─── ListBody ─────────────────────────────────────────────────────────────────

type SubTab = 'members' | 'applications' | 'removed';

interface ListBodyProps {
  x: number;
  y: number;
  width: number;
  height: number;
  subTab: SubTab;
  members: SpaceMember[];
  applications: SpaceApplication[];
  removed: RemovedMember[];
  loading: boolean;
  page: number;
  myRole: number;
  myUserId: string;
  onKick: (m: SpaceMember) => void;
  onUnkick: (m: RemovedMember) => void;
  onApprove: (a: SpaceApplication) => void;
  onReject: (a: SpaceApplication) => void;
}

function ListBody(p: ListBodyProps) {
  const {
    x, y, width,
    subTab, members, applications, removed,
    loading, page,
    myRole, myUserId,
    onKick, onUnkick, onApprove, onReject,
  } = p;

  if (loading) {
    return (
      <group position={[x, y, 0]}>
        <Label text="加载中…" fontSize={0.022} color="#444" />
      </group>
    );
  }

  const EMPTY_MSG: Record<SubTab, string> = {
    members: '暂无成员',
    applications: '暂无加入申请',
    removed: '黑名单为空',
  };

  const currentList =
    subTab === 'members' ? members :
    subTab === 'applications' ? applications :
    removed;

  const pageItems = currentList.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (pageItems.length === 0) {
    return (
      <group position={[x, y, 0]}>
        <Label text={EMPTY_MSG[subTab]} fontSize={0.022} color="#555" />
      </group>
    );
  }

  // Top-aligned rows: first row center at body top edge
  const startY = p.height / 2 - ROW_H / 2;

  return (
    <group position={[x, y, 0]}>
      {subTab === 'members' && (pageItems as SpaceMember[]).map((m, i) => (
        <group key={m.userId} position={[0, startY - i * (ROW_H + ROW_GAP), 0]}>
          <MemberRow
            member={m}
            width={width}
            myRole={myRole}
            myUserId={myUserId}
            onKick={() => onKick(m)}
          />
        </group>
      ))}

      {subTab === 'applications' && (pageItems as SpaceApplication[]).map((a, i) => (
        <group key={a.userId} position={[0, startY - i * (ROW_H + ROW_GAP), 0]}>
          <ApplicationRow
            app={a}
            width={width}
            onApprove={() => onApprove(a)}
            onReject={() => onReject(a)}
          />
        </group>
      ))}

      {subTab === 'removed' && (pageItems as RemovedMember[]).map((m, i) => (
        <group key={m.userId} position={[0, startY - i * (ROW_H + ROW_GAP), 0]}>
          <RemovedRow
            member={m}
            width={width}
            onUnkick={() => onUnkick(m)}
          />
        </group>
      ))}
    </group>
  );
}

// ─── MemberTab ────────────────────────────────────────────────────────────────

interface MemberTabProps {
  width: number;
  height: number;
}

export function MemberTab({ width, height }: MemberTabProps) {
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  const myUserId = (useAuthStore((s) => s.user?.id) ?? '') as string;
  const memberListKey = useSpaceUIStore((s) => s.memberListKey);
  const applicationListKey = useSpaceUIStore((s) => s.applicationListKey);

  const [subTab, setSubTab] = useState<SubTab>('members');
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [applications, setApplications] = useState<SpaceApplication[]>([]);
  const [removed, setRemoved] = useState<RemovedMember[]>([]);
  const [myRole, setMyRole] = useState(0);
  const [membersLoading, setMembersLoading] = useState(true);
  const [appsLoading, setAppsLoading] = useState(false);
  const [removedLoading, setRemovedLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [confirmKick, setConfirmKick] = useState<SpaceMember | null>(null);
  const [status, setStatus] = useState<StatusMsg | null>(null);

  const pushStatus = useCallback((kind: StatusKind, text: string) => {
    setStatus({ kind, text, nonce: performance.now() });
  }, []);
  const clearStatus = useCallback(() => setStatus(null), []);

  const isAdmin = myRole >= 1;

  // ── Load members (on mount + memberListKey) ──────────────────────────────

  useEffect(() => {
    if (!activeSpace) return;
    setMembersLoading(true);
    setPage(0);
    spacesApi
      .getMembers(activeSpace.id)
      .then(({ members: list, myRole: role }) => {
        setMembers(list);
        setMyRole(role);
      })
      .catch(() => pushStatus('error', '加载成员列表失败'))
      .finally(() => setMembersLoading(false));
  }, [activeSpace, memberListKey, pushStatus]);

  // ── Load applications (lazy, admin-only) ─────────────────────────────────

  useEffect(() => {
    if (subTab !== 'applications' || !activeSpace || !isAdmin) return;
    setAppsLoading(true);
    setPage(0);
    spacesApi
      .getApplications(activeSpace.id)
      .then(({ applications: list }) => setApplications(list))
      .catch(() => pushStatus('error', '加载申请列表失败'))
      .finally(() => setAppsLoading(false));
  }, [subTab, activeSpace, isAdmin, applicationListKey, pushStatus]);

  // ── Load removed (lazy, admin-only) ──────────────────────────────────────

  useEffect(() => {
    if (subTab !== 'removed' || !activeSpace || !isAdmin) return;
    setRemovedLoading(true);
    setPage(0);
    spacesApi
      .getRemovedMembers(activeSpace.id)
      .then(({ removed: list }) => setRemoved(list))
      .catch(() => pushStatus('error', '加载黑名单失败'))
      .finally(() => setRemovedLoading(false));
  }, [subTab, activeSpace, isAdmin, pushStatus]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSubTabChange = (t: SubTab) => {
    setSubTab(t);
    setPage(0);
    setConfirmKick(null);
  };

  const handleKick = async (member: SpaceMember) => {
    if (!activeSpace) return;
    try {
      await spacesApi.kickMember(activeSpace.id, member.userId);
      setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
      setConfirmKick(null);
      pushStatus('success', `${member.nickname} 已被踢出`);
    } catch {
      pushStatus('error', '踢出操作失败');
      setConfirmKick(null);
    }
  };

  const handleUnkick = async (member: RemovedMember) => {
    if (!activeSpace) return;
    try {
      await spacesApi.unkickMember(activeSpace.id, member.userId);
      setRemoved((prev) => prev.filter((m) => m.userId !== member.userId));
      pushStatus('success', `已将 ${member.nickname} 移出黑名单`);
    } catch {
      pushStatus('error', '操作失败');
    }
  };

  const handleApprove = async (app: SpaceApplication) => {
    if (!activeSpace) return;
    try {
      await spacesApi.approveApplication(activeSpace.id, app.userId);
      setApplications((prev) => prev.filter((a) => a.userId !== app.userId));
      pushStatus('success', `已通过 ${app.nickname} 的申请`);
    } catch {
      pushStatus('error', '操作失败');
    }
  };

  const handleReject = async (app: SpaceApplication) => {
    if (!activeSpace) return;
    try {
      await spacesApi.rejectApplication(activeSpace.id, app.userId);
      setApplications((prev) => prev.filter((a) => a.userId !== app.userId));
      pushStatus('success', `已拒绝 ${app.nickname} 的申请`);
    } catch {
      pushStatus('error', '操作失败');
    }
  };

  // ── Layout ────────────────────────────────────────────────────────────────

  const statusBarY = height / 2 - STATUS_BAR_H / 2;

  // Current list for pagination (members always available; apps/removed lazy-loaded)
  const currentList =
    subTab === 'members' ? members :
    subTab === 'applications' ? applications :
    removed;
  const totalPages = Math.max(1, Math.ceil(currentList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  const loading =
    subTab === 'members' ? membersLoading :
    subTab === 'applications' ? appsLoading :
    removedLoading;

  // Title row center
  const titleY = height / 2 - 0.022;

  // Segment bar (admin only)
  const afterTitleBottom = titleY - 0.014;
  const segBarY = afterTitleBottom - SEG_H / 2;
  const afterSegBottom = isAdmin
    ? segBarY - SEG_H / 2 - 0.010
    : afterTitleBottom - 0.008;

  // Pagination bar
  const hasPagination = totalPages > 1;
  const pageBarY = -height / 2 + PAGE_BTN_H / 2 + 0.008;
  const listBodyBottom = hasPagination ? pageBarY + PAGE_BTN_H / 2 + 0.008 : -height / 2;

  // List body occupies space between header and pagination
  const listBodyTop = afterSegBottom;
  const listBodyH = listBodyTop - listBodyBottom;
  const listBodyCY = (listBodyTop + listBodyBottom) / 2;

  // Segment tab definitions with live counts
  const SEG_TABS: Array<{ key: SubTab; label: string }> = [
    { key: 'members', label: members.length > 0 ? `成员 ${members.length}` : '成员' },
    { key: 'applications', label: applications.length > 0 ? `申请 ${applications.length}` : '申请' },
    { key: 'removed', label: removed.length > 0 ? `移出 ${removed.length}` : '移出' },
  ];

  const segGap = 0.008;
  const segW = (width - segGap * 2) / 3;

  // ── Confirm Kick Overlay ──────────────────────────────────────────────────

  if (confirmKick) {
    const overlayW = width * 0.90;
    const overlayH = height * 0.46;
    return (
      <group>
        <Plate x={0} y={0} width={overlayW} height={overlayH} radius={0.018} color="rgba(255,255,255,0.98)">
          <Label
            y={overlayH * 0.28}
            text={`确认踢出「${confirmKick.nickname}」？`}
            fontSize={0.026}
            color="#000"
            maxWidth={overlayW * 0.85}
          />
          <Label y={overlayH * 0.08} text="踢出后对方无法重新加入，" fontSize={0.018} color="#444" />
          <Label y={-overlayH * 0.06} text="直到管理员主动解除。" fontSize={0.018} color="#444" />
          <group position={[0, -overlayH * 0.30, 0.001]}>
            <Btn
              x={-overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label="取消"
              variant="ghost"
              onPress={() => setConfirmKick(null)}
            />
            <Btn
              x={overlayW * 0.24}
              width={overlayW * 0.40}
              height={0.052}
              label="确认踢出"
              variant="danger"
              onPress={() => handleKick(confirmKick)}
            />
          </group>
        </Plate>
        <StatusBar status={status} onClear={clearStatus} width={width} y={statusBarY} />
      </group>
    );
  }

  // ── Main View ─────────────────────────────────────────────────────────────

  return (
    <group>
      {/* Title */}
      <Label
        x={-width / 2 + 0.016}
        y={titleY}
        text="成员管理"
        fontSize={0.028}
        anchorX="left"
        color="#000"
      />
      <Label
        x={width / 2 - 0.016}
        y={titleY}
        text={`共 ${members.length} 人`}
        fontSize={0.018}
        anchorX="right"
        color="#333"
      />

      {/* Segment control (admin only) */}
      {isAdmin && SEG_TABS.map((s, i) => (
        <Btn
          key={s.key}
          x={-width / 2 + segW / 2 + i * (segW + segGap)}
          y={segBarY}
          width={segW}
          height={SEG_H}
          radius={0.010}
          label={s.label}
          fontSize={0.018}
          variant="segment"
          active={subTab === s.key}
          onPress={() => handleSubTabChange(s.key)}
        />
      ))}

      {/* List body */}
      <ListBody
        x={0}
        y={listBodyCY}
        width={width}
        height={listBodyH}
        subTab={subTab}
        members={members}
        applications={applications}
        removed={removed}
        loading={loading}
        page={safePage}
        myRole={myRole}
        myUserId={myUserId}
        onKick={(m) => setConfirmKick(m)}
        onUnkick={handleUnkick}
        onApprove={handleApprove}
        onReject={handleReject}
      />

      {/* Pagination */}
      {hasPagination && (
        <group position={[0, pageBarY, 0.001]}>
          <Btn
            x={-0.14}
            width={0.062}
            height={PAGE_BTN_H}
            radius={0.008}
            label="上页"
            fontSize={0.016}
            variant="ghost"
            disabled={safePage === 0}
            onPress={() => setPage(safePage - 1)}
          />
          <Label
            x={0}
            y={0}
            text={`${safePage + 1} / ${totalPages}`}
            fontSize={0.02}
            color="#222"
          />
          <Btn
            x={0.14}
            width={0.062}
            height={PAGE_BTN_H}
            radius={0.008}
            label="下页"
            fontSize={0.016}
            variant="ghost"
            disabled={safePage === totalPages - 1}
            onPress={() => setPage(safePage + 1)}
          />
        </group>
      )}

      <StatusBar status={status} onClear={clearStatus} width={width} y={statusBarY} />
    </group>
  );
}
