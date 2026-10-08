import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import { PlusIcon, ArrowRightIcon, UsersIcon, XIcon, Trash2Icon, LogOutIcon, CalendarIcon, HashIcon, LockIcon, LockOpenIcon, ClipboardListIcon, ClockIcon, RefreshCwIcon } from 'lucide-react';
import { useSpaceStore } from '../data/spaceStore';
import { spacesApi, type SpaceInfo } from '../api/spaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PanelMode = 'list' | 'create' | 'join';

const MemberRoleLabel: Record<number, string> = { 0: '成员', 1: '管理员', 2: '所有者' };

function SpaceCard({
  space,
  onSelect,
  confirmDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  space: SpaceInfo;
  onSelect: (s: SpaceInfo) => void;
  confirmDelete: boolean;
  onRequestDelete: (s: SpaceInfo) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (s: SpaceInfo) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/50 transition-all hover:border-indigo-200 hover:bg-slate-50 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <button
          onClick={() => onSelect(space)}
          className="group flex min-w-0 flex-1 items-center gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-indigo-50/50"
        >
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <UsersIcon size={20} strokeWidth={3} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-black text-slate-900 border-b-2 border-transparent group-hover:border-indigo-600/30">空间 {space.accessCode}</span>
              <span className="shrink-0 rounded-md bg-slate-200 px-2.5 py-0.5 text-xs font-black text-slate-700">
                {MemberRoleLabel[space.myRole ?? 0] ?? '成员'}
              </span>
            </div>
            <p className="truncate text-sm font-bold text-slate-500 pt-0.5">ID: {space.id.slice(0, 8)}…</p>
          </div>
          <ArrowRightIcon size={20} strokeWidth={3} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-indigo-600" />
        </button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="shrink-0 size-10 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
          onClick={() => onRequestDelete(space)}
          aria-label={`删除空间 ${space.accessCode}`}
        >
          <Trash2Icon size={20} strokeWidth={2.5} />
        </Button>
      </div>
      {confirmDelete && (
        <div className="border-t border-red-100 bg-red-50/50 px-5 py-5">
          <p className="text-base font-black text-red-700">
            {space.myRole === 2 ? `解散空间 ${space.accessCode}？` : `退出空间 ${space.accessCode}？`}
          </p>
          <p className="mt-2 text-sm font-bold text-red-600/80 leading-relaxed">
            {space.myRole === 2
              ? '你是该空间的所有者，解散后将同步删除所有快照及成员关系，且无法恢复。'
              : '退出后你将离开该空间，可凭访问码重新加入。'}
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 px-4 border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 active:scale-95 transition-all shadow-sm"
              onClick={onCancelDelete}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-10 px-4 text-sm font-black shadow-md shadow-red-200 active:scale-95 transition-all"
              onClick={() => onConfirmDelete(space)}
            >
              {space.myRole === 2 ? '确认解散' : '确认退出'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 申请中（PENDING）或已批准待进入（APPROVED_PENDING_JOIN）的空间卡片 */
function PendingSpaceCard({ space, onEnter }: { space: SpaceInfo; onEnter?: () => void }) {
  const { fetchMySpaces } = useSpaceStore();
  const [checking, setChecking] = useState(false);
  const isApproved = (space.memberStatus ?? 0) === 1;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await fetchMySpaces();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className={`overflow-hidden rounded-xl border-2 transition-all shadow-sm ${
      isApproved 
        ? 'border-green-200 bg-green-50/50' 
        : 'border-amber-200 bg-amber-50/50'
    }`}>
      <div className="flex items-center gap-4 px-5 py-5">
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl shadow-sm ${
          isApproved ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'
        }`}>
          {isApproved ? <ArrowRightIcon size={22} strokeWidth={3} /> : <ClockIcon size={22} strokeWidth={3} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-lg font-black text-slate-900">空间 {space.accessCode}</span>
            <span className={`shrink-0 rounded-md px-2.5 py-0.5 text-xs font-black ${
              isApproved
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-amber-100 text-amber-700 border border-amber-200'
            }`}>
              {isApproved ? '已批准' : '审批中'}
            </span>
          </div>
          <p className="text-sm font-bold text-slate-500 pt-1">
            {isApproved ? '点击进入即可加入该空间' : '等待管理员审批后即可加入'}
          </p>
        </div>
        {isApproved ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onEnter}
            className="shrink-0 h-10 px-4 font-black text-green-700 bg-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm active:scale-95"
          >
            进入
            <ArrowRightIcon size={16} strokeWidth={3} className="ml-1.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={checking}
            onClick={handleCheck}
            className="shrink-0 size-10 rounded-xl text-amber-700 hover:bg-amber-100 active:scale-95 transition-all"
            aria-label="刷新申请状态"
          >
            <RefreshCwIcon size={20} strokeWidth={3} className={checking ? 'animate-spin' : ''} />
          </Button>
        )}
      </div>
    </div>
  );
}

export function SpaceModal({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const { activeSpace } = useSpaceStore();
  if (activeSpace && activeSpace.id) {
    return <SpaceDetail open={open} space={activeSpace} onClose={onClose} />;
  } else {
    return <SpaceList open={open} onClose={onClose} />;
  }
}

const SpaceStatusLabel: Record<number, string> = { 0: '开放加入', 1: '需申请', 2: '已关闭' };

function SpaceDetail({ open, space, onClose }: { open: boolean; space: SpaceInfo; onClose?: () => void }) {
  const { clearActiveSpace, updateActiveSpace } = useSpaceStore();
  const [statusUpdating, setStatusUpdating] = useState(false);

  const isAdmin = (space.myRole ?? 0) >= 1;

  const handleStatusChange = async (newStatus: number) => {
    if (newStatus === space.status) return;
    setStatusUpdating(true);
    try {
      await spacesApi.updateSpaceStatus(space.id, newStatus);
      updateActiveSpace({ status: newStatus });
      toast.success('空间状态已更新');
    } catch {
      toast.error('更新状态失败');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleLeave = () => {
    clearActiveSpace();
    toast.success('已退出空间', { description: `空间 ${space.accessCode} 已退出。` });
    onClose?.();
  };

  const formattedDate = new Date(space.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Dialog.Root open={open} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-300" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
          onInteractOutside={(e) => { if (onClose) onClose(); else e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (onClose) onClose(); else e.preventDefault(); }}
        >
          <Dialog.Title className="sr-only">当前协作空间</Dialog.Title>
          <Dialog.Description className="sr-only">查看当前协作空间的详情</Dialog.Description>

          <Card className="relative w-full max-w-md bg-white border-slate-200 shadow-2xl text-slate-900 overflow-hidden">
            {onClose && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-90"
              >
                <XIcon size={20} strokeWidth={3} />
              </button>
            )}

            <CardHeader className="pb-6 px-8 pt-8 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-5">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
                  <UsersIcon size={28} strokeWidth={2.5} />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">当前协作空间</CardTitle>
                  <CardDescription className="text-sm font-bold text-slate-500 mt-1">你已成功进入协作环境</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-6 px-8 pb-10 pt-8">
              {/* 访问码 */}
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-indigo-100 bg-indigo-50/30 px-6 py-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <HashIcon size={16} strokeWidth={3} className="text-indigo-600" />
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-600/70">访问码</span>
                </div>
                <div className="text-center">
                  <span className="font-mono text-5xl font-black tracking-[0.3em] text-slate-900 ml-[0.3em]">
                    {space.accessCode}
                  </span>
                </div>
              </div>

              {/* 信息列表 */}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm font-black text-slate-500">我的角色</span>
                  <span className="rounded-md bg-slate-900 px-3 py-1 text-xs font-black text-white shadow-sm">
                    {MemberRoleLabel[space.myRole ?? 0] ?? '成员'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="text-sm font-black text-slate-500">空间状态</span>
                  <span className={cn(
                    'rounded-md px-3 py-1 text-xs font-black shadow-sm border',
                    space.status === 0 ? 'bg-green-100 text-green-700 border-green-200' :
                    space.status === 1 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  )}>
                    {SpaceStatusLabel[space.status] ?? '未知'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-6 py-4">
                  <span className="flex items-center gap-2 text-sm font-black text-slate-500">
                    <CalendarIcon size={16} strokeWidth={2.5} />
                    创建于
                  </span>
                  <span className="text-sm font-black text-slate-900">{formattedDate}</span>
                </div>
              </div>

              {/* 操作 */}
              {isAdmin && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-6 py-5">
                  <p className="mb-4 text-xs font-black uppercase tracking-widest text-slate-500">管理员控制台</p>
                  <div className="flex gap-2">
                    {([
                      { value: 0, label: '开放', icon: LockOpenIcon, color: 'green' },
                      { value: 1, label: '申请制', icon: ClipboardListIcon, color: 'amber' },
                      { value: 2, label: '关闭', icon: LockIcon, color: 'red' },
                    ] as const).map(({ value, label, icon: Icon, color }) => {
                      const isActive = space.status === value;
                      return (
                        <button
                          key={value}
                          disabled={statusUpdating}
                          onClick={() => handleStatusChange(value)}
                          className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-2 rounded-xl py-3 text-xs font-black transition-all border-2',
                            isActive 
                              ? color === 'green' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' :
                                color === 'amber' ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100' :
                                'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100'
                              : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:text-slate-600',
                            statusUpdating && 'opacity-50 cursor-not-allowed',
                          )}
                        >
                          <Icon size={18} strokeWidth={isActive ? 3 : 2.5} />
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 退出 */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 border-slate-200 bg-white text-slate-600 font-black hover:bg-slate-50 hover:text-red-600 hover:border-red-100 transition-all active:scale-[0.98]"
                onClick={handleLeave}
              >
                <LogOutIcon size={18} strokeWidth={3} className="mr-2" />
                退出当前空间
              </Button>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SpaceList({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const [mode, setMode] = useState<PanelMode>('list');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmDeleteSpaceId, setConfirmDeleteSpaceId] = useState<string | null>(null);

  const { spaces, isLoading, fetchMySpaces, setActiveSpace, activeSpace, addSpace, addPendingSpace, removeSpace, pendingSpaces } = useSpaceStore();

  useEffect(() => {
    if (open) {
      fetchMySpaces();
      setConfirmDeleteSpaceId(null);
    }
  }, [open, fetchMySpaces]);

  const handleSelect = (space: SpaceInfo) => {
    setActiveSpace(space);
    toast.success('已进入空间', { description: `访问码：${space.accessCode}` });
    onClose?.();
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { space } = await spacesApi.create();
      addSpace(space);
      setActiveSpace(space);
      onClose?.();
      toast.success('空间已创建', { description: `访问码：${space.accessCode}` });
    } catch (err: any) {
      toast.error('创建失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.length !== 4) return;
    setLoading(true);
    try {
      const res = await spacesApi.join(joinCode);
      if (res.alreadyMember || res.joined) {
        addSpace(res.space);
        setActiveSpace(res.space);
        toast.success(res.alreadyMember ? '已在该空间中' : '成功加入空间');
        onClose?.();
      } else {
        addPendingSpace({ ...res.space, memberStatus: 0 });
        toast.info('申请已提交', { description: '等待管理员审批后即可加入' });
      }
      setJoinCode('');
    } catch (err: any) {
      toast.error('加入失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestDelete = (space: SpaceInfo) => {
    setConfirmDeleteSpaceId(space.id);
  };

  const handleConfirmDelete = async (space: SpaceInfo) => {
    setLoading(true);
    try {
      await spacesApi.delete(space.id);
      removeSpace(space.id);
      setConfirmDeleteSpaceId(null);
      if (space.myRole === 2) {
        toast.success('空间已解散', { description: `空间 ${space.accessCode} 及其所有数据已删除。` });
      } else {
        toast.success('已退出空间', { description: `你已离开空间 ${space.accessCode}。` });
      }
    } catch (err: any) {
      toast.error('操作失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/10 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-300" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
          onInteractOutside={(e) => { if (onClose) onClose(); else e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (onClose) onClose(); else e.preventDefault(); }}
        >
          <Dialog.Title className="sr-only">选择协作空间</Dialog.Title>
          <Dialog.Description className="sr-only">浏览、创建或加入协作空间</Dialog.Description>

          <Card className="relative w-full max-w-md bg-white border-slate-200 shadow-2xl text-slate-900 overflow-hidden">
            {onClose && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-10 rounded-full p-2 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-90"
              >
                <XIcon size={20} strokeWidth={3} />
              </button>
            )}
            {/* 顶部 tab 导航 */}
            <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
              {(['list', 'create', 'join'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setMode(tab)}
                  className={cn(
                    'flex-1 py-5 text-sm font-black transition-all relative',
                    mode === tab
                      ? 'text-indigo-600 after:absolute after:bottom-[-1px] after:left-1/4 after:right-1/4 after:h-1 after:bg-indigo-600 after:rounded-full'
                      : 'text-slate-400 hover:text-slate-600',
                  )}
                >
                  {tab === 'list' ? '我的空间' : tab === 'create' ? '新建空间' : '加入空间'}
                </button>
              ))}
            </div>

            <CardContent className="pt-8 px-8 pb-10">
              {mode === 'list' && (
                <div className="flex flex-col gap-4 min-h-64">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                      <RefreshCwIcon size={24} className="animate-spin text-indigo-600" />
                      <p className="text-sm font-black text-slate-400">加载空间列表中…</p>
                    </div>
                  ) : spaces.length === 0 && pendingSpaces.length === 0 ? (
                    <div className="flex flex-col items-center gap-6 py-16 text-slate-300">
                      <div className="size-20 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center">
                        <UsersIcon size={40} strokeWidth={1.5} />
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-black text-slate-900">暂无协作空间</p>
                        <p className="mt-1 text-sm font-bold text-slate-500">创建一个新空间或凭访问码加入</p>
                      </div>
                      <div className="flex gap-3">
                        <Button size="sm" variant="outline" className="h-10 px-5 border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-50 shadow-sm" onClick={() => setMode('create')}>
                          <PlusIcon size={18} strokeWidth={3} className="mr-2" /> 新建
                        </Button>
                        <Button size="sm" variant="outline" className="h-10 px-5 border-slate-200 bg-white font-black text-slate-700 hover:bg-slate-50 shadow-sm" onClick={() => setMode('join')}>
                          加入
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {spaces.map((s) => (
                        <SpaceCard
                          key={s.id}
                          space={s}
                          onSelect={handleSelect}
                          confirmDelete={confirmDeleteSpaceId === s.id}
                          onRequestDelete={handleRequestDelete}
                          onCancelDelete={() => setConfirmDeleteSpaceId(null)}
                          onConfirmDelete={handleConfirmDelete}
                        />
                      ))}
                      {pendingSpaces.length > 0 && (
                        <>
                          <div className="flex items-center gap-3 pt-6 pb-2">
                             <div className="h-px flex-1 bg-slate-100" />
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">申请记录</p>
                             <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          {pendingSpaces.map((s) => (
                            <PendingSpaceCard
                              key={s.id}
                              space={s}
                              onEnter={s.memberStatus === 1 ? () => {
                                addSpace({ ...s, memberStatus: 2 });
                                setActiveSpace({ ...s, memberStatus: 2 });
                                toast.success('已进入空间', { description: `访问码：${s.accessCode}` });
                                onClose?.();
                              } : undefined}
                            />
                          ))}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* 新建空间 */}
              {mode === 'create' && (
                <div className="flex flex-col items-center gap-8 py-8 text-center">
                  <div className="size-20 rounded-3xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 ring-8 ring-indigo-50">
                    <PlusIcon size={40} strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">创建新的协作空间</h3>
                    <p className="mt-3 text-sm font-bold text-slate-500 leading-relaxed px-4">
                      系统将生成唯一的 <span className="text-indigo-600 font-black">4 位访问码</span>，
                      <br />将其分享给协作者即可开始同步构建。
                    </p>
                  </div>
                  <Button onClick={handleCreate} disabled={loading} className="w-full h-14 text-lg font-black shadow-xl shadow-indigo-200 active:scale-95 transition-all">
                    {loading ? (
                      <>
                        <RefreshCwIcon size={20} className="mr-2 animate-spin" />
                        正在初始化…
                      </>
                    ) : '立即创建空间'}
                  </Button>
                </div>
              )}

              {/* 加入空间 */}
              {mode === 'join' && (
                <form onSubmit={handleJoin} className="py-6">
                  <FieldGroup className="gap-8">
                    <Field>
                      <FieldLabel htmlFor="access-code" className="text-sm font-black text-slate-500 mb-3 ml-1 block uppercase tracking-widest text-center">
                        输入 4 位访问码
                      </FieldLabel>
                      <Input
                        id="access-code"
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        pattern="\d{4}"
                        placeholder="0000"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        required
                        className="text-center text-5xl font-black tracking-[0.5em] h-24 bg-slate-50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white transition-all shadow-inner rounded-2xl placeholder:text-slate-200"
                      />
                    </Field>
                    <Button type="submit" disabled={loading || joinCode.length !== 4} className="h-14 text-lg font-black shadow-xl shadow-indigo-200 active:scale-95 transition-all">
                      {loading ? '正在验证…' : '加入协作空间'}
                    </Button>
                  </FieldGroup>
                </form>
              )}
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
