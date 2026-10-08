import { useEffect, useState } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import { UserIcon, KeyRoundIcon, FingerprintIcon, XIcon, PlusIcon, Trash2Icon, MonitorSmartphoneIcon, Loader2Icon } from 'lucide-react';
import { useAuthStore } from '../data/authStore';
import { userApi, type ChangePasswordParams } from '../api/user';
import { passkeyApi, type PasskeyCredential } from '../api/passkey';
import { clearToken } from '../api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'profile' | 'password' | 'passkeys';

// ── Sub-panels ────────────────────────────────────────────────────────────────

function ProfileTab({ onClose }: { onClose?: () => void }) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [nickname, setNickname] = useState(user?.nickname ?? '');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setLoading(true);
    try {
      const res = await userApi.patchMe({ nickname: nickname.trim() });
      setUser(res.user);
      toast.success('昵称已更新');
    } catch (err: any) {
      toast.error('保存失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    setUser(null);
    onClose?.();
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel className="text-black/50 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">用户名</FieldLabel>
          <Input
            value={user?.username ?? ''}
            readOnly
            className="bg-black/5 border-black/5 text-black/40 font-bold cursor-not-allowed h-11"
          />
        </Field>
        <Field>
          <FieldLabel className="text-black/50 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">昵称</FieldLabel>
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="输入显示昵称"
            className="bg-black/5 border-black/10 text-black font-bold placeholder:text-black/20 focus:border-indigo-600/50 h-11 shadow-inner"
          />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-sm font-black shadow-lg shadow-indigo-600/10"
      >
        {loading ? '保存中…' : '保存修改'}
      </Button>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full rounded-xl py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
      >
        退出登录
      </button>
    </form>
  );
}

function PasswordTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next || !confirm) return;
    if (next !== confirm) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (next.length < 8) {
      toast.error('新密码至少需要 8 位');
      return;
    }
    setLoading(true);
    try {
      await userApi.changePassword({ oldPassword: current, newPassword: next });
      toast.success('密码修改成功');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err: any) {
      toast.error('修改失败', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel className="text-black/50 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">当前密码</FieldLabel>
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="bg-black/5 border-black/10 text-black font-bold placeholder:text-black/20 focus:border-indigo-600/50 h-11 shadow-inner"
          />
        </Field>
        <Field>
          <FieldLabel className="text-black/50 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">新密码</FieldLabel>
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="bg-black/5 border-black/10 text-black font-bold placeholder:text-black/20 focus:border-indigo-600/50 h-11 shadow-inner"
          />
        </Field>
        <Field>
          <FieldLabel className="text-black/50 text-xs font-bold uppercase tracking-wider mb-1.5 ml-1">确认新密码</FieldLabel>
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
            className="bg-black/5 border-black/10 text-black font-bold placeholder:text-black/20 focus:border-indigo-600/50 h-11 shadow-inner"
          />
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 text-sm font-black shadow-lg shadow-indigo-600/10"
      >
        {loading ? '修改中…' : '修改密码'}
      </Button>
    </form>
  );
}

function PasskeysTab() {
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [addingName, setAddingName] = useState('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    passkeyApi.list()
      .then(setPasskeys)
      .catch((err: any) => toast.error('获取通行证列表失败', { description: err.message }))
      .finally(() => setListLoading(false));
  }, []);

  const handleAddStart = () => {
    setAddingName('');
    setShowNameInput(true);
  };

  const handleAddConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addingName.trim() || '我的通行证';
    setAdding(true);
    try {
      const credential = await passkeyApi.register(name);
      setPasskeys((prev) => [...prev, credential]);
      setShowNameInput(false);
      toast.success('通行证已添加');
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        toast.error('添加失败', { description: err.message });
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteRequest = (id: string) => {
    setConfirmDeleteId(id);
  };

  const handleDeleteConfirm = async (id: string) => {
    setDeletingId(id);
    try {
      await passkeyApi.delete(id);
      setPasskeys((prev) => prev.filter((pk) => pk.id !== id));
      toast.success('通行证已删除');
    } catch (err: any) {
      toast.error('删除失败', { description: err.message });
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-5">
      {/* List */}
      {listLoading ? (
        <div className="flex justify-center py-12 text-black/20">
          <Loader2Icon size={28} className="animate-spin" />
        </div>
      ) : passkeys.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-black/30">
          <div className="size-16 rounded-2xl bg-black/5 flex items-center justify-center">
            <FingerprintIcon size={32} strokeWidth={2} />
          </div>
          <p className="text-sm font-bold">尚未添加通行证</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="flex items-center gap-4 rounded-xl border border-black/5 bg-black/5 px-4 py-3.5 shadow-sm"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-600 shadow-sm">
                <MonitorSmartphoneIcon size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-black">{pk.deviceName}</p>
                <div className="mt-0.5 space-y-0.5">
                  <p className="text-[10px] font-bold text-black/40 uppercase tracking-tight">创建于 {formatDate(pk.createdAt)}</p>
                  {pk.lastUsedAt && (
                    <p className="text-[10px] font-bold text-indigo-600/50 uppercase tracking-tight">上次使用 {formatDate(pk.lastUsedAt)}</p>
                  )}
                </div>
              </div>
              {confirmDeleteId === pk.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => handleDeleteConfirm(pk.id)}
                    disabled={deletingId === pk.id}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-black text-white shadow-md shadow-red-600/20 transition-all disabled:opacity-50"
                  >
                    {deletingId === pk.id ? <Loader2Icon size={12} className="animate-spin" /> : '确认'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black/40 ring-1 ring-black/10 hover:bg-black/5 transition-all"
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleDeleteRequest(pk.id)}
                  className="shrink-0 rounded-lg p-2 text-black/20 hover:bg-red-50 hover:text-red-500 transition-colors"
                  title="删除通行证"
                >
                  <Trash2Icon size={18} strokeWidth={2.5} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Add device name input */}
      {showNameInput ? (
        <form onSubmit={handleAddConfirm} className="flex gap-2 p-1.5 bg-black/5 rounded-xl border border-black/5 shadow-inner">
          <Input
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            placeholder="通行证名称…"
            autoFocus
            className="flex-1 bg-transparent border-0 text-black font-bold placeholder:text-black/20 h-10 text-sm focus-visible:ring-0"
          />
          <Button
            type="submit"
            disabled={adding}
            className="shrink-0 h-10 px-4 text-xs font-black"
          >
            {adding ? <Loader2Icon size={14} className="animate-spin" /> : '确认'}
          </Button>
          <button
            type="button"
            onClick={() => setShowNameInput(false)}
            className="shrink-0 rounded-lg w-10 h-10 flex items-center justify-center text-black/30 hover:bg-black/10 transition-colors"
          >
            <XIcon size={18} strokeWidth={2.5} />
          </button>
        </form>
      ) : (
        <Button
          onClick={handleAddStart}
          className="w-full h-11 border border-dashed border-black/20 bg-transparent font-bold text-black/50 hover:bg-black/5 hover:text-black hover:border-black/40 transition-all"
        >
          <PlusIcon size={18} strokeWidth={2.5} className="mr-2" />
          添加通行证
        </Button>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { key: 'profile', label: '个人信息', icon: UserIcon },
  { key: 'password', label: '修改密码', icon: KeyRoundIcon },
  { key: 'passkeys', label: '通行证', icon: FingerprintIcon },
];

export function UserModal({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const [tab, setTab] = useState<TabKey>('profile');

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose?.()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
          onInteractOutside={() => onClose?.()}
        >
          <Dialog.Title className="sr-only">用户设置</Dialog.Title>
          <Dialog.Description className="sr-only">管理账户信息、密码与通行证</Dialog.Description>

          <Card className="w-full max-w-sm bg-white border-black/10 shadow-2xl text-black overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/5">
              <span className="text-base font-black text-black">账户设置</span>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-black/40 hover:bg-black/5 hover:text-black transition-colors"
              >
                <XIcon size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex px-4 border-b border-black/5 bg-black/[0.02]">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1.5 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative',
                    tab === key
                      ? 'text-indigo-600 after:absolute after:bottom-0 after:left-1/4 after:right-1/4 after:h-1 after:bg-indigo-600 after:rounded-full'
                      : 'text-black/30 hover:text-black/60',
                  )}
                >
                  <Icon size={18} strokeWidth={2.5} />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <CardContent className="px-6 py-8">
              {tab === 'profile' && <ProfileTab onClose={onClose} />}
              {tab === 'password' && <PasswordTab />}
              {tab === 'passkeys' && <PasskeysTab />}
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
