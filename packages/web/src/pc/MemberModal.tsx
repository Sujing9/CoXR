import React, { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import {
    XIcon,
    UsersIcon,
    UserXIcon,
    CheckCircle2Icon,
    XCircleIcon,
    ClockIcon,
    ShieldIcon,
    CrownIcon,
} from 'lucide-react';
import { useSpaceStore } from '../data/spaceStore';
import { useAuthStore } from '../data/authStore';
import { useSpaceUIStore } from '../data/spaceUIStore';
import { spacesApi, type SpaceMember, type SpaceApplication, type RemovedMember } from '../api/spaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<number, string> = { 0: '成员', 1: '管理员', 2: '所有者' };

const ROLE_ICON = {
    0: null,
    1: ShieldIcon,
    2: CrownIcon,
} as Record<number, React.ElementType | null>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null, label: string) {
    if (!iso) return null;
    return `${label} ${new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
}

// ─── MemberRow ────────────────────────────────────────────────────────────────

function MemberRow({
    member,
    myRole,
    myUserId,
    onKick,
}: {
    member: SpaceMember;
    myRole: number;
    myUserId: string;
    onKick: (m: SpaceMember) => void;
}) {
    const isSelf = member.userId === myUserId;
    const canKick = !isSelf && myRole >= 1 && member.memberRole < myRole;
    const RoleIcon = (ROLE_ICON[member.memberRole] ?? null) as React.ElementType<{ size?: number; className?: string }> | null;

    // Display time: prefer lastJoinedAt, fall back to lastLeftAt
    const timeLabel = member.lastJoinedAt
        ? formatTime(member.lastJoinedAt, '加入')
        : formatTime(member.lastLeftAt, '离开');

    return (
        <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-black/5 px-4 py-3">
            {/* Avatar placeholder */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-black/80 text-sm font-bold select-none">
                {member.nickname.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-bold text-black">{member.nickname}</span>
                    {isSelf && (
                        <span className="shrink-0 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600">我</span>
                    )}
                    {RoleIcon && <RoleIcon size={12} strokeWidth={2.5} className="shrink-0 text-black/60" />}
                    <span className="text-xs font-semibold text-black/60">{ROLE_LABEL[member.memberRole]}</span>
                </div>
                {timeLabel && <p className="text-xs font-medium text-black/40">{timeLabel}</p>}
            </div>

            {canKick && (
                <button
                    onClick={() => onKick(member)}
                    className="shrink-0 rounded-lg p-2 text-black/40 transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label={`踢出 ${member.nickname}`}
                >
                    <UserXIcon size={16} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}

// ─── ApplicationRow ───────────────────────────────────────────────────────────

function ApplicationRow({
    app,
    onApprove,
    onReject,
}: {
    app: SpaceApplication;
    onApprove: (a: SpaceApplication) => void;
    onReject: (a: SpaceApplication) => void;
}) {
    const appliedAt = formatTime(app.createdAt, '申请于');
    return (
        <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-black/5 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/10 text-black/80 text-sm font-bold select-none">
                {app.nickname.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-bold text-black">{app.nickname}</span>
                {appliedAt && <p className="text-xs font-medium text-black/40">{appliedAt}</p>}
            </div>

            <div className="flex shrink-0 items-center gap-1">
                <button
                    onClick={() => onApprove(app)}
                    className="rounded-lg p-2 text-black/40 transition-colors hover:bg-green-500/10 hover:text-green-600"
                    aria-label="通过申请"
                >
                    <CheckCircle2Icon size={16} strokeWidth={2.5} />
                </button>
                <button
                    onClick={() => onReject(app)}
                    className="rounded-lg p-2 text-black/40 transition-colors hover:bg-red-500/10 hover:text-red-500"
                    aria-label="拒绝申请"
                >
                    <XCircleIcon size={16} strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}

// ─── RemovedRow ───────────────────────────────────────────────────────────────

function RemovedRow({
    member,
    onUnkick,
}: {
    member: RemovedMember;
    onUnkick: (m: RemovedMember) => void;
}) {
    const kickedAt = formatTime(member.updatedAt, '被踢出于');
    return (
        <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-black/5 px-4 py-3 opacity-70">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 text-sm font-bold select-none">
                {member.nickname.slice(0, 1).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
                <span className="truncate text-sm font-bold text-black/70">{member.nickname}</span>
                {kickedAt && <p className="text-xs font-medium text-black/40">{kickedAt}</p>}
            </div>

            <button
                onClick={() => onUnkick(member)}
                className="shrink-0 rounded-lg p-2 text-black/40 transition-colors hover:bg-green-500/10 hover:text-green-600"
                aria-label={`移出黑名单 ${member.nickname}`}
            >
                <UserXIcon size={16} strokeWidth={2.5} className="rotate-12" />
            </button>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'members' | 'applications' | 'removed';

export function MemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activeSpace } = useSpaceStore();
    const { user: authUser } = useAuthStore();
    const { memberListKey, applicationListKey } = useSpaceUIStore();
    const myUserId = (authUser?.id as string) ?? '';

    const [tab, setTab] = useState<Tab>('members');
    const [members, setMembers] = useState<SpaceMember[]>([]);
    const [applications, setApplications] = useState<SpaceApplication[]>([]);
    const [removed, setRemoved] = useState<RemovedMember[]>([]);
    const [myRole, setMyRole] = useState(0);
    const [loading, setLoading] = useState(false);
    const [appLoading, setAppLoading] = useState(false);
    const [removedLoading, setRemovedLoading] = useState(false);

    // Kick confirm state
    const [confirmKickMember, setConfirmKickMember] = useState<SpaceMember | null>(null);

    const isAdmin = myRole >= 1;

    // Load members on open, or when memberListKey changes (server push)
    useEffect(() => {
        if (!open || !activeSpace) return;
        if (memberListKey === 0) {
            // First load: also reset tab
            setTab('members');
            setConfirmKickMember(null);
        }
        setLoading(true);
        spacesApi
            .getMembers(activeSpace.id)
            .then(({ members: list, myRole: role }) => {
                setMembers(list);
                setMyRole(role);
            })
            .catch(() => toast.error('加载成员列表失败'))
            .finally(() => setLoading(false));
    }, [open, activeSpace, memberListKey]);

    // Load applications when tab switches to 'applications' (admin only), or when applicationListKey changes
    useEffect(() => {
        if (tab !== 'applications' || !activeSpace || !isAdmin) return;
        setAppLoading(true);
        spacesApi
            .getApplications(activeSpace.id)
            .then(({ applications: list }) => setApplications(list))
            .catch(() => toast.error('加载申请列表失败'))
            .finally(() => setAppLoading(false));
    }, [tab, activeSpace, isAdmin, applicationListKey]);

    // Load removed members when tab switches
    useEffect(() => {
        if (tab !== 'removed' || !activeSpace || !isAdmin) return;
        setRemovedLoading(true);
        spacesApi
            .getRemovedMembers(activeSpace.id)
            .then(({ removed: list }) => setRemoved(list))
            .catch(() => toast.error('加载黑名单失败'))
            .finally(() => setRemovedLoading(false));
    }, [tab, activeSpace, isAdmin]);

    // ── Kick ──────────────────────────────────────────────────────────────────

    const handleKick = async (member: SpaceMember) => {
        if (!activeSpace) return;
        try {
            await spacesApi.kickMember(activeSpace.id, member.userId);
            setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
            setConfirmKickMember(null);
            toast.success(`${member.nickname} 已被踢出`);
        } catch {
            toast.error('踢出操作失败');
        }
    };

    // ── Unkick ────────────────────────────────────────────────────────────────

    const handleUnkick = async (member: RemovedMember) => {
        if (!activeSpace) return;
        try {
            await spacesApi.unkickMember(activeSpace.id, member.userId);
            setRemoved((prev) => prev.filter((m) => m.userId !== member.userId));
            toast.success(`已将 ${member.nickname} 移出黑名单`);
        } catch {
            toast.error('操作失败');
        }
    };

    // ── Approve / Reject ──────────────────────────────────────────────────────

    const handleApprove = async (app: SpaceApplication) => {
        if (!activeSpace) return;
        try {
            await spacesApi.approveApplication(activeSpace.id, app.userId);
            setApplications((prev) => prev.filter((a) => a.userId !== app.userId));
            toast.success(`已通过 ${app.nickname} 的申请`);
        } catch {
            toast.error('操作失败');
        }
    };

    const handleReject = async (app: SpaceApplication) => {
        if (!activeSpace) return;
        try {
            await spacesApi.rejectApplication(activeSpace.id, app.userId);
            setApplications((prev) => prev.filter((a) => a.userId !== app.userId));
            toast.success(`已拒绝 ${app.nickname} 的申请`);
        } catch {
            toast.error('操作失败');
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <Dialog.Root open={open} modal>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
                <Dialog.Content
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
                    onInteractOutside={onClose}
                    onEscapeKeyDown={onClose}
                >
                    <Dialog.Title className="sr-only">成员管理</Dialog.Title>
                    <Dialog.Description className="sr-only">查看和管理协作空间成员</Dialog.Description>

                    <Card className="relative w-full max-w-md bg-white border-black/10 shadow-2xl text-black">
                        <button
                            onClick={onClose}
                            className="absolute right-3 top-3 z-10 rounded-lg p-2 text-black/40 transition-colors hover:bg-black/5 hover:text-black"
                        >
                            <XIcon size={18} strokeWidth={2.5} />
                        </button>

                        <CardHeader className="pb-0">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
                                    <UsersIcon size={22} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-black">成员管理</CardTitle>
                                    <CardDescription className="text-sm font-semibold text-black/50">
                                        {isAdmin ? '查看成员、踢出成员，并处理加入申请' : '查看空间成员信息'}
                                    </CardDescription>
                                </div>
                            </div>

                            {/* Tabs (admin-only applications tab) */}
                            {isAdmin && (
                                <div className="mt-4 flex border-b border-black/10">
                                    <button
                                        onClick={() => setTab('members')}
                                        className={cn(
                                            'flex-1 py-3 text-sm font-bold transition-colors relative',
                                            tab === 'members'
                                                ? 'text-teal-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-teal-500 after:rounded-full'
                                                : 'text-black/40 hover:text-black/70',
                                        )}
                                    >
                                        成员列表
                                        <span className={cn(
                                            "ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
                                            tab === 'members' ? "bg-teal-500/10 text-teal-600" : "bg-black/5 text-black/40"
                                        )}>
                                            {members.length}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => setTab('applications')}
                                        className={cn(
                                            'flex-1 py-3 text-sm font-bold transition-colors relative',
                                            tab === 'applications'
                                                ? 'text-teal-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-teal-500 after:rounded-full'
                                                : 'text-black/40 hover:text-black/70',
                                        )}
                                    >
                                        加入申请
                                        {applications.length > 0 && (
                                            <span className="ml-1.5 rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] font-bold text-yellow-700">
                                                {applications.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setTab('removed')}
                                        className={cn(
                                            'flex-1 py-3 text-sm font-bold transition-colors relative',
                                            tab === 'removed'
                                                ? 'text-teal-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-1 after:bg-teal-500 after:rounded-full'
                                                : 'text-black/40 hover:text-black/70',
                                        )}
                                    >
                                        已移出
                                        {removed.length > 0 && (
                                            <span className="ml-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600">
                                                {removed.length}
                                            </span>
                                        )}
                                    </button>
                                </div>
                            )}
                        </CardHeader>

                        <CardContent className="pt-4 px-4 pb-6">
                            {/* ── Members tab ─────────────────────────────────────────── */}
                            {tab === 'members' && (
                                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                                    {loading ? (
                                        <p className="py-8 text-center text-sm font-bold text-black/40">加载中…</p>
                                    ) : members.length === 0 ? (
                                        <p className="py-8 text-center text-sm font-bold text-black/40">暂无成员</p>
                                    ) : (
                                        <>
                                            {members.map((m) => (
                                                <div key={m.userId}>
                                                    <MemberRow
                                                        member={m}
                                                        myRole={myRole}
                                                        myUserId={myUserId}
                                                        onKick={(member) => setConfirmKickMember(member)}
                                                    />
                                                    {/* Kick confirm inline */}
                                                    {confirmKickMember?.userId === m.userId && (
                                                        <div className="mt-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
                                                            <p className="text-sm font-bold text-red-700">
                                                                确认踢出「{m.nickname}」？
                                                            </p>
                                                            <p className="mt-1 text-xs font-semibold text-red-600/70">
                                                                踢出后其无法重新加入，直到管理员取消踢出。
                                                            </p>
                                                            <div className="mt-3 flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 border-black/10 bg-white text-xs font-bold text-black hover:bg-black/5"
                                                                    onClick={() => setConfirmKickMember(null)}
                                                                >
                                                                    取消
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-8 text-xs font-bold shadow-sm"
                                                                    onClick={() => handleKick(m)}
                                                                >
                                                                    确认踢出
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Applications tab ─────────────────────────────────────── */}
                            {tab === 'applications' && (
                                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                                    {appLoading ? (
                                        <p className="py-8 text-center text-sm font-bold text-black/40">加载中…</p>
                                    ) : applications.length === 0 ? (
                                        <div className="flex flex-col items-center gap-3 py-10 text-black/30">
                                            <ClockIcon size={32} strokeWidth={1.5} />
                                            <p className="text-sm font-bold">暂无待审批申请</p>
                                        </div>
                                    ) : (
                                        applications.map((app) => (
                                            <ApplicationRow
                                                key={app.userId}
                                                app={app}
                                                onApprove={handleApprove}
                                                onReject={handleReject}
                                            />
                                        ))
                                    )}
                                </div>
                            )}

                            {/* ── Removed tab ──────────────────────────────────────────── */}
                            {tab === 'removed' && (
                                <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                                    <p className="pb-1 text-xs font-bold text-black/40">点击右侧按钮可将该用户从黑名单中删除</p>
                                    {removedLoading ? (
                                        <p className="py-8 text-center text-sm font-bold text-black/40">加载中…</p>
                                    ) : removed.length === 0 ? (
                                        <p className="py-8 text-center text-sm font-bold text-black/40">暂无被移出的成员</p>
                                    ) : (
                                        removed.map((m) => (
                                            <RemovedRow key={m.userId} member={m} onUnkick={handleUnkick} />
                                        ))
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
