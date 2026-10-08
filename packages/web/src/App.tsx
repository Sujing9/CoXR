import { useEffect, useRef, useState } from 'react';
import { Toaster } from 'sonner';
import { Canvas } from '@react-three/fiber';
import { XR, PointerEvents, useXR } from '@react-three/xr';
import * as THREE from 'three';
import { xrStore } from './xr/xrStore';
import { ModeSwitch } from './rig/ModeSwitch';
import { XRShell } from './xr/XRShell';
import { Scene } from './scene/Scene';
import { DocProvider } from './data/DocContext';
import { PCShell } from './pc/PCShell';
import { useAuthStore } from './data/authStore';
import { useSpaceStore } from './data/spaceStore';
import { AuthModal } from './overlay/AuthModal';
import { XRWelcomeModal } from './overlay/XRWelcomeModal';

/**
 * 仅在 XR session 激活时挂载 PointerEvents，避免替换 PC 的 R3F DOM 事件系统。
 */
function XRPointerEventsBridge() {
  const inXR = useXR((s) => s.session != null);
  return inXR ? <PointerEvents /> : null;
}

export function App() {
  const { checkAuth, isLoggedIn, isLoading } = useAuthStore();
  const { activeSpace } = useSpaceStore();
  const [xrWelcomeOpen, setXrWelcomeOpen] = useState(false);
  // 用于清理延迟定时器，防止组件卸载或登录状态变化时泄漏
  const xrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 登录成功（含静默恢复）后延迟 2s 检测 WebXR 支持
  // - 延迟确保浏览器 XR 栈就绪，避免时而检测不到的问题
  // - 每次登录都检测，除非用户明确选择了「不再提示」
  useEffect(() => {
    // 清除上一轮可能残留的定时器
    if (xrTimerRef.current) {
      clearTimeout(xrTimerRef.current);
      xrTimerRef.current = null;
    }

    if (!isLoggedIn || isLoading) return;
    if (localStorage.getItem('coxr_xr_welcome_disabled') === '1') return;

    xrTimerRef.current = setTimeout(() => {
      xrTimerRef.current = null;
      navigator.xr
        ?.isSessionSupported('immersive-vr')
        .then((supported) => { if (supported) setXrWelcomeOpen(true); })
        .catch(() => {/* 不支持或检测失败，静默忽略 */});
    }, 2000);

    return () => {
      if (xrTimerRef.current) {
        clearTimeout(xrTimerRef.current);
        xrTimerRef.current = null;
      }
    };
  }, [isLoggedIn, isLoading]);

  const needAuth = !isLoading && !isLoggedIn;

  return (
    <DocProvider spaceId={activeSpace?.id ?? null}>
      <Toaster richColors position="top-center" />
      <div className="relative h-full w-full">
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{
            antialias: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            outputColorSpace: THREE.SRGBColorSpace,
          }}
        >
          <XR store={xrStore}>
            {/* 仅在 XR session 中桥接控制器射线事件，PC 使用 R3F 默认 DOM 事件 */}
            <XRPointerEventsBridge />
            <Scene />
            <ModeSwitch />
            {/* XR 专属 R3F UI 壳，仅在 XR session 中渲染 */}
            <XRShell />
          </XR>
        </Canvas>
        {/* PC 专属 HTML overlay 壳，进入 XR 后自动隐藏 */}
        <PCShell />
        {/* 认证弹窗保留为 HTML，PC/XR 均适用（XR 启动前必须先登录） */}
        {needAuth && <AuthModal />}
        {/* 登录后检测到 XR 设备时弹出欢迎引导 */}
        <XRWelcomeModal open={xrWelcomeOpen} onClose={() => setXrWelcomeOpen(false)} />
      </div>
    </DocProvider>
  );
}
