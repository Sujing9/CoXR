import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import { XIcon, HistoryIcon, PlusIcon, Trash2Icon, RotateCcwIcon, CameraIcon } from 'lucide-react';
import { useSpaceStore } from '../data/spaceStore';
import { useDoc } from '../data/DocContext';
import { spacesApi, type SnapshotMeta } from '../api/spaces';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ─── Component ────────────────────────────────────────────────────────────────

export function SnapshotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { activeSpace } = useSpaceStore();
    const { getDocAsBase64, restoreFromSnapshot } = useDoc();

    const isOwner = (activeSpace?.myRole ?? 0) === 2;

    const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
    const [loading, setLoading] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [restoringId, setRestoringId] = useState<string | null>(null);

    // Load snapshot list when opened
    useEffect(() => {
        if (!open || !activeSpace) return;
        setLoading(true);
        setConfirmDeleteId(null);
        setShowCreateForm(false);
        setNewName('');
        spacesApi
            .listSnapshots(activeSpace.id)
            .then(({ snapshots: list }) => setSnapshots(list))
            .catch(() => toast.error('加载快照列表失败'))
            .finally(() => setLoading(false));
    }, [open, activeSpace]);

    // ── Create ────────────────────────────────────────────────────────────────

    const handleCreate = async () => {
        if (!activeSpace || !newName.trim()) return;
        const base64 = getDocAsBase64();
        if (!base64) {
            toast.error('无法读取当前文档状态');
            return;
        }
        setCreating(true);
        try {
            const { snapshot } = await spacesApi.createSnapshot(activeSpace.id, newName.trim(), base64);
            setSnapshots((prev) => [...prev, snapshot]);
            setNewName('');
            setShowCreateForm(false);
            toast.success('快照已创建', { description: snapshot.name });
        } catch {
            toast.error('创建快照失败');
        } finally {
            setCreating(false);
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────

    const handleDelete = async (snapshotId: string) => {
        if (!activeSpace) return;
        try {
            await spacesApi.deleteSnapshot(activeSpace.id, snapshotId);
            setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
            setConfirmDeleteId(null);
            toast.success('快照已删除');
        } catch {
            toast.error('删除快照失败');
        }
    };

    // ── Restore ───────────────────────────────────────────────────────────────

    const handleRestore = async (snapshot: SnapshotMeta) => {
        if (!activeSpace) return;
        setRestoringId(snapshot.id);
        try {
            const { yjsDocument } = await spacesApi.restoreSnapshot(activeSpace.id, snapshot.id);
            restoreFromSnapshot(yjsDocument);
            toast.success('快照已恢复', { description: snapshot.name });
            onClose();
        } catch {
            toast.error('恢复快照失败');
        } finally {
            setRestoringId(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });

    return (
        <Dialog.Root open={open} modal>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
                <Dialog.Content
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
                    onInteractOutside={onClose}
                    onEscapeKeyDown={onClose}
                >
                    <Dialog.Title className="sr-only">快照管理</Dialog.Title>
                    <Dialog.Description className="sr-only">管理协作空间的历史快照</Dialog.Description>

                    <Card className="relative w-full max-w-md bg-white border-black/10 shadow-2xl text-black">
                        <button
                            onClick={onClose}
                            className="absolute right-3 top-3 z-10 rounded-lg p-2 text-black/40 transition-colors hover:bg-black/5 hover:text-black"
                        >
                            <XIcon size={18} strokeWidth={2.5} />
                        </button>

                        <CardHeader className="pb-3 px-6 pt-6">
                            <div className="flex items-center gap-4">
                                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-600/10 text-violet-600">
                                    <HistoryIcon size={22} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <CardTitle className="text-lg font-bold text-black">快照管理</CardTitle>
                                    <CardDescription className="text-sm font-semibold text-black/50">
                                        {isOwner ? '查看、创建、删除或恢复快照' : '仅查看快照列表'}
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-4 px-6 pb-8">
                            {/* Create snapshot (owner only) */}
                            {isOwner && (
                                <div className="rounded-xl border border-black/5 bg-black/5 overflow-hidden transition-all">
                                    {!showCreateForm ? (
                                        <button
                                            onClick={() => setShowCreateForm(true)}
                                            className="flex w-full items-center gap-2.5 px-4 py-3.5 text-sm font-bold text-black/60 transition-colors hover:bg-black/5 hover:text-black/80"
                                        >
                                            <CameraIcon size={16} strokeWidth={2.5} />
                                            创建新快照
                                        </button>
                                    ) : (
                                        <div className="flex gap-2 p-3">
                                            <Input
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                placeholder="输入快照名称"
                                                className="h-9 flex-1 bg-white border-black/10 text-black placeholder:text-black/30 text-sm font-semibold focus:border-violet-500/50 focus:ring-violet-500/20"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleCreate();
                                                    if (e.key === 'Escape') setShowCreateForm(false);
                                                }}
                                                autoFocus
                                            />
                                            <Button
                                                size="sm"
                                                className="h-9 bg-violet-600 hover:bg-violet-700 text-white font-bold shadow-md shadow-violet-600/20"
                                                onClick={handleCreate}
                                                disabled={creating || !newName.trim()}
                                            >
                                                <PlusIcon size={16} strokeWidth={2.5} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-9 text-black/40 hover:text-black/70 font-bold"
                                                onClick={() => { setShowCreateForm(false); setNewName(''); }}
                                            >
                                                <XIcon size={16} strokeWidth={2.5} />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Snapshot list */}
                            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
                                {loading ? (
                                    <p className="py-10 text-center text-sm font-bold text-black/40">加载中…</p>
                                ) : snapshots.length === 0 ? (
                                    <p className="py-10 text-center text-sm font-bold text-black/40">暂无历史快照</p>
                                ) : (
                                    snapshots.map((snapshot) => (
                                        <div
                                            key={snapshot.id}
                                            className="overflow-hidden rounded-xl border border-black/5 bg-black/5 transition-colors hover:border-black/10 hover:bg-black-[0.02]"
                                        >
                                            <div className="flex items-center gap-3 px-4 py-3.5">
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-bold text-black text-lg">{snapshot.name}</p>
                                                    <p className="text-xs font-semibold text-black/40">{formatDate(snapshot.createdAt)}</p>
                                                </div>

                                                {isOwner && (
                                                    <div className="flex shrink-0 items-center gap-1.5">
                                                        <button
                                                            onClick={() =>
                                                                setConfirmDeleteId(
                                                                    confirmDeleteId === snapshot.id ? null : snapshot.id,
                                                                )
                                                            }
                                                            className="rounded-lg p-2 text-black/40 transition-colors hover:bg-red-500/10 hover:text-red-500"
                                                            aria-label="删除快照"
                                                        >
                                                            <Trash2Icon size={16} strokeWidth={2.5} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleRestore(snapshot)}
                                                            disabled={restoringId === snapshot.id}
                                                            className={cn(
                                                                'rounded-lg p-2 text-black/40 transition-colors hover:bg-violet-600/10 hover:text-violet-600',
                                                                restoringId === snapshot.id && 'opacity-50 cursor-not-allowed',
                                                            )}
                                                            aria-label="恢复快照"
                                                        >
                                                            <RotateCcwIcon size={16} strokeWidth={2.5} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Confirm delete */}
                                            {confirmDeleteId === snapshot.id && (
                                                <div className="border-t border-red-500/10 bg-red-500/5 px-4 py-3.5">
                                                    <p className="text-sm font-bold text-red-700">确认删除快照「{snapshot.name}」？</p>
                                                    <div className="mt-3 flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 border-black/10 bg-white text-xs font-bold text-black hover:bg-black/5"
                                                            onClick={() => setConfirmDeleteId(null)}
                                                        >
                                                            取消
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            className="h-8 text-xs font-bold shadow-sm"
                                                            onClick={() => handleDelete(snapshot.id)}
                                                        >
                                                            确认删除
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
