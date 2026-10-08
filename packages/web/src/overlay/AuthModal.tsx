import React, { useState } from 'react';
import { Dialog } from 'radix-ui';
import { toast } from 'sonner';
import { useAuthStore } from '../data/authStore';
import { authApi } from '../api/auth';
import { passkeyApi } from '../api/passkey';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AuthModal() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    try {
      if (isLoginMode) {
        const res = await authApi.login({ username, password });
        setUser(res.user);
        toast.success('登录成功');
      } else {
        const res = await authApi.register({ username, password, nickname: username });
        setUser(res.user);
        toast.success('注册成功');
      }
    } catch (err: any) {
      toast.error(isLoginMode ? '登录失败' : '注册失败', {
        description: err.message || '操作失败',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    setPasskeyLoading(true);
    try {
      const res = await passkeyApi.login();
      setUser(res.user);
      toast.success('通行证登录成功');
    } catch (err: any) {
      // 用户主动取消不提示错误
      if (err?.name === 'NotAllowedError') return;
      toast.error('通行证登录失败', {
        description: err.message || '操作失败',
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Dialog.Root open modal>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">
            {isLoginMode ? '登录 CoXR' : '创建新账户'}
          </Dialog.Title>

          <Card className="w-full max-w-sm bg-white border-zinc-200 shadow-2xl text-zinc-900">
            {/* 顶部 tab 导航 */}
            <div className="flex border-b border-zinc-200">
              {([true, false] as const).map((login) => (
                <button
                  key={String(login)}
                  onClick={() => {
                    setIsLoginMode(login);
                    setUsername('');
                    setPassword('');
                  }}
                  className={cn(
                    'flex-1 py-4 text-base font-bold transition-colors',
                    isLoginMode === login
                      ? 'border-b-2 border-indigo-700 text-zinc-950'
                      : 'text-zinc-500 hover:text-black',
                  )}
                >
                  {login ? '登录' : '注册'}
                </button>
              ))}
            </div>

            <CardContent className="pt-5">
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="username" className="text-zinc-900 font-bold">
                      账户名
                    </FieldLabel>
                    <Input
                      id="username"
                      type="text"
                      placeholder="输入账户名"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="username"
                      className="font-medium"
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password" className="text-zinc-900 font-bold">
                      密码
                    </FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      placeholder="输入密码"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete={isLoginMode ? 'current-password' : 'new-password'}
                      className="font-medium"
                    />
                  </Field>
                  <Field>
                    <Button type="submit" disabled={loading} className="w-full font-bold text-base">
                      {loading ? '请稍候…' : isLoginMode ? '登录' : '注册'}
                    </Button>
                    <div
                      className={cn(
                        'grid transition-all duration-300 ease-in-out',
                        isLoginMode ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                      )}
                    >
                      <div className="overflow-hidden">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handlePasskey}
                          disabled={passkeyLoading}
                          tabIndex={isLoginMode ? 0 : -1}
                          className="w-full border-zinc-300 bg-zinc-50 text-zinc-950 hover:bg-zinc-100 hover:text-black font-bold"
                        >
                          {passkeyLoading ? '验证中…' : '使用通行证登录'}
                        </Button>
                      </div>
                    </div>
                    <FieldDescription className="text-center text-zinc-600 font-medium">
                      {isLoginMode ? '还没有账户？' : '已有账户？'}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsLoginMode(!isLoginMode);
                          setUsername('');
                          setPassword('');
                        }}
                        className="text-zinc-900 font-bold underline-offset-4 hover:underline transition-colors"
                      >
                        {isLoginMode ? '立即注册' : '返回登录'}
                      </button>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
