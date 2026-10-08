import { useEffect } from 'react';
import { useIsInXR } from '../xr/useIsInXR';
import { useAuthStore } from '../data/authStore';
import { useSpaceStore } from '../data/spaceStore';
import { useSpaceUIStore } from '../data/spaceUIStore';
import { FloatingMenu } from './FloatingMenu';
import { Navigator } from './Navigator';
import { DetailPanel } from './panels/DetailPanel';
import { useVoiceManager } from '../voice/useVoiceManager';

/**
 * PC 端专属 HTML overlay 壳层。
 * - 进入 XR session 后整体隐藏
 * - 登录且未激活空间时：仅显示 FloatingMenu（用于选择空间）
 * - 登录且已激活空间时：显示 Navigator + DetailPanel + FloatingMenu
 */
export function PCShell() {
  const inXR = useIsInXR();
  const { isLoggedIn, isLoading } = useAuthStore();
  const { activeSpace } = useSpaceStore();
  const { navigatorOpen, detailPanelVisible, reset } = useSpaceUIStore();

  // 语音生命周期管理（仅登录后挂载）
  useVoiceManager();

  // 退出空间时清空 UI 焦点状态
  useEffect(() => {
    if (!activeSpace) reset();
  }, [activeSpace, reset]);

  if (inXR) return null;
  if (isLoading || !isLoggedIn) return null;

  return (
    <>
      <FloatingMenu />
      {activeSpace && navigatorOpen && (
        <div
          className="pointer-events-none absolute inset-0 flex items-stretch gap-3 p-4 max-h-full overflow-hidden"
          style={{ zIndex: 10 }}
        >
          {/* 左侧导航栏 */}
          <div className="pointer-events-auto h-full">
            <Navigator />
          </div>

          {/* 右侧详情面板 */}
          {detailPanelVisible && (
            <div className="pointer-events-auto flex flex-1 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl backdrop-blur-xl">
              <DetailPanel />
            </div>
          )}
        </div>
      )}
    </>
  );
}
