import { Dialog } from 'radix-ui';
import { XIcon, GlobeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { xrStore } from '../xr/xrStore';

const LS_KEY = 'coxr_xr_welcome_disabled';

interface XRWelcomeModalProps {
    open: boolean;
    onClose: () => void;
}

export function XRWelcomeModal({ open, onClose }: XRWelcomeModalProps) {
    const handleEnterXR = () => {
        onClose();
        xrStore.enterVR();
    };

    const handleDontShowAgain = () => {
        localStorage.setItem(LS_KEY, '1');
        onClose();
    };

    return (
        <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200" />
                <Dialog.Content
                    aria-describedby={undefined}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
                >
                    <div className="w-[min(92vw,380px)] rounded-2xl border border-zinc-200 bg-white shadow-2xl overflow-hidden">
                        {/* 顶部光晕装饰 */}
                        <div
                            className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 size-48 rounded-full blur-3xl"
                            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)' }}
                        />

                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                            <div className="flex items-center gap-2">
                                <GlobeIcon size={16} className="text-indigo-700" />
                                <Dialog.Title className="text-sm font-bold text-zinc-950">
                                    检测到 XR 设备
                                </Dialog.Title>
                            </div>
                            <Dialog.Close asChild>
                                <button className="flex size-7 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black">
                                    <XIcon size={15} />
                                </button>
                            </Dialog.Close>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-8 text-center">
                            {/* XR 图标 */}
                            <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
                                {/* 外圈脉冲环 */}
                                <span className="absolute inset-0 rounded-full border border-indigo-300 animate-ping" style={{ animationDuration: '2s' }} />
                                <span className="absolute inset-2 rounded-full border border-indigo-200 animate-ping" style={{ animationDuration: '2s', animationDelay: '0.4s' }} />
                                {/* 图标背景 */}
                                <div className="relative flex size-16 items-center justify-center rounded-full bg-indigo-100 ring-1 ring-indigo-200">
                                    <GlobeIcon size={30} className="text-indigo-700" />
                                </div>
                            </div>

                            <p id="xr-welcome-desc" className="text-sm text-zinc-900 font-bold leading-relaxed">
                                你的设备支持沉浸式 XR 体验。<br />
                                戴上头显，进入空间化数据世界。
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 border-t border-zinc-100 px-4 py-4">
                            <button
                                onClick={handleEnterXR}
                                className={cn(
                                    'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5',
                                    'bg-indigo-600 text-sm font-bold text-white',
                                    'transition-colors hover:bg-indigo-700 active:bg-indigo-800',
                                )}
                            >
                                <GlobeIcon size={15} />
                                进入 XR 模式
                            </button>
                            <button
                                onClick={onClose}
                                className={cn(
                                    'flex w-full items-center justify-center rounded-xl px-4 py-2.5',
                                    'bg-zinc-100 text-sm text-zinc-900 font-bold',
                                    'transition-colors hover:bg-zinc-200 hover:text-black',
                                )}
                            >
                                稍后再说
                            </button>
                            <button
                                onClick={handleDontShowAgain}
                                className="mt-1 w-full text-center text-xs text-zinc-500 font-bold transition-colors hover:text-black"
                            >
                                不再提示
                            </button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
