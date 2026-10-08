import { useCallback, useEffect, useRef, useState } from 'react';
import { LayersIcon, UserIcon, BlocksIcon, XIcon, HistoryIcon, UsersIcon, MicIcon, BoxIcon } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SpaceModal } from './SpaceModal';
import { UserModal } from './UserModal';
import { SnapshotModal } from './SnapshotModal';
import { MemberModal } from './MemberModal';
import { VoiceModal } from './VoiceModal';
import { XRWelcomeModal } from '../overlay/XRWelcomeModal';
import { useSpaceStore } from '../data/spaceStore';

// ── Constants ─────────────────────────────────────────────────────────────────

const BALL_SIZE = 52;
const BALL_DOT_SIZE = 32;
const MARGIN = 20;
const DRAG_THRESHOLD = 6;
const ORBIT_RADIUS = 108;

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function clampPos(x: number, y: number) {
  return {
    x: clamp(x, MARGIN, window.innerWidth - BALL_SIZE - MARGIN),
    y: clamp(y, MARGIN, window.innerHeight - BALL_SIZE - MARGIN),
  };
}

// ── Menu items ────────────────────────────────────────────────────────────────

const STATIC_MENU_ITEMS = [
  { icon: BlocksIcon, label: '空间管理', action: 'space' as const },
  { icon: UserIcon, label: '账户设置', action: 'account' as const },
  { icon: BoxIcon, label: '进入 XR', action: 'xr' as const },
] as const;

type StaticAction = typeof STATIC_MENU_ITEMS[number]['action'];
type DynamicAction = 'members' | 'snapshot' | 'voice';
type MenuAction = StaticAction | DynamicAction;

const ORBIT_START_ANGLE = -90;

// ── Component ─────────────────────────────────────────────────────────────────

export function FloatingMenu() {
  // Position of the floating ball (left-top corner of the BALL_SIZE box)
  const [pos, setPos] = useState(() => clampPos(
    window.innerWidth - BALL_SIZE - MARGIN,
    window.innerHeight - BALL_SIZE - MARGIN,
  ));

  // Enable spring transition on position (snap-back / resize clamp)
  const [isAnimating, setIsAnimating] = useState(false);

  // Menu open state
  const [isOpen, setIsOpen] = useState(false);

  // Space modal visibility
  const [spaceOpen, setSpaceOpen] = useState(false);

  // User modal visibility
  const [userOpen, setUserOpen] = useState(false);

  // Snapshot modal visibility
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  // Member modal visibility
  const [memberOpen, setMemberOpen] = useState(false);

  // Voice modal visibility
  const [voiceOpen, setVoiceOpen] = useState(false);

  // XR welcome modal visibility
  const [xrOpen, setXrOpen] = useState(false);

  const { activeSpace } = useSpaceStore();

  // 动态菜单：有激活空间时追加面板切换项
  const menuItems = [
    ...STATIC_MENU_ITEMS,
      ...(activeSpace
      ? [
          { icon: UsersIcon, label: '成员管理', action: 'members' as MenuAction },
          { icon: HistoryIcon, label: '快照管理', action: 'snapshot' as MenuAction },
          { icon: MicIcon, label: '语音通话', action: 'voice' as MenuAction },
        ]
      : []),
  ];

  // Drag state stored in a ref to avoid stale closures in pointer handlers
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    moved: false,
  });

  // ── Pointer handlers (drag) ──────────────────────────────────────────────

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isOpen) return;
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
      setIsAnimating(false);
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        originX: pos.x,
        originY: pos.y,
        moved: false,
      };
    },
    [isOpen, pos],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    setPos({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!dragRef.current.active) return;
    const { moved } = dragRef.current;
    dragRef.current.active = false;

    // Animate position snap-back to within viewport
    setIsAnimating(true);
    setPos((prev) => clampPos(prev.x, prev.y));

    // Click: displacement below threshold → open menu
    if (!moved) {
      setIsOpen(true);
    }
  }, []);

  // ── Resize: re-clamp position ────────────────────────────────────────────

  useEffect(() => {
    const onResize = () => {
      setIsAnimating(true);
      setPos((prev) => clampPos(prev.x, prev.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const handleClose = () => setIsOpen(false);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Backdrop + circular menu ─────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 49,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isOpen ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0)',
          backdropFilter: isOpen ? 'blur(12px)' : 'blur(0px)',
          transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={handleClose}
      >
        {/* Menu hub — centered in viewport */}
        <div
          style={{
            position: 'relative',
            width: BALL_SIZE,
            height: BALL_SIZE,
            transition:
              'opacity 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            opacity: isOpen ? 1 : 0,
            transform: `scale(${isOpen ? 1 : 0.6})`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button at center */}
          <button
            onClick={handleClose}
            className={cn(
              'absolute inset-0 z-10 flex items-center justify-center rounded-full',
              'bg-white backdrop-blur-2xl border border-black/10 shadow-lg',
              'text-black/70 hover:bg-black/5 hover:text-black transition-colors',
            )}
          >
            <XIcon size={24} strokeWidth={2.5} />
          </button>

          {/* Circular orbit items */}
          {menuItems.map(({ icon: Icon, label, action }, i) => {
            const angle = ORBIT_START_ANGLE + (360 / menuItems.length) * i;
            const rad = (angle * Math.PI) / 180;
            const ox = Math.cos(rad) * ORBIT_RADIUS;
            const oy = Math.sin(rad) * ORBIT_RADIUS;
            const delay = i * 55;

            return (
              <div
                key={label}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                  whiteSpace: 'nowrap',
                  // Staggered entrance: translate toward orbit position + scale up
                  transform: isOpen
                    ? `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px)) scale(1)`
                    : `translate(-50%, -50%) scale(0.2)`,
                  opacity: isOpen ? 1 : 0,
                  transition: [
                    `opacity 0.28s ease ${delay}ms`,
                    `transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
                  ].join(', '),
                }}
              >
                <button
                  onClick={() => {
                    if (action === 'space') {
                      setIsOpen(false);
                      setSpaceOpen(true);
                    } else if (action === 'account') {
                      setIsOpen(false);
                      setUserOpen(true);
                    } else if (action === 'snapshot') {
                      setIsOpen(false);
                      setSnapshotOpen(true);
                    } else if (action === 'members') {
                      setIsOpen(false);
                      setMemberOpen(true);
                    } else if (action === 'voice') {
                      setIsOpen(false);
                      setVoiceOpen(true);
                    } else if (action === 'xr') {
                      setIsOpen(false);
                      navigator.xr
                        ?.isSessionSupported('immersive-vr')
                        .then((supported) => {
                          if (supported) {
                            setXrOpen(true);
                          } else {
                            toast.error('当前设备不支持 XR 模式', {
                              description: '需要支持 WebXR 的头显设备（如 Meta Quest）。',
                            });
                          }
                        })
                        .catch(() => {
                          toast.error('XR 检测失败', {
                            description: '无法检测当前设备的 XR 支持情况。',
                          });
                        });
                    }
                  }}
                  disabled={false}
                  className={cn(
                    'flex size-14 items-center justify-center rounded-full',
                    'border border-black/10 backdrop-blur-xl shadow-md',
                    'text-black/80 transition-colors hover:bg-black/5 hover:text-black cursor-pointer',
                    'bg-white',
                  )}
                >
                  <Icon size={24} strokeWidth={2.5} />
                </button>
                <span
                  className="text-sm font-bold text-black/90 select-none"
                  style={{
                    opacity: isOpen ? 1 : 0,
                    transition: `opacity 0.25s ease ${delay + 80}ms`,
                  }}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Floating ball ────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 50,
          touchAction: 'none',
          userSelect: 'none',
          // Only the translate is here — spring transition applies on snap-back / resize
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: isAnimating
            ? 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)'
            : 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Visual shell — fades out when menu opens */}
        <div
          className={cn(
            'flex items-center justify-center rounded-full cursor-grab active:cursor-grabbing',
            'backdrop-blur-xl',
            'shadow-[0_8px_32px_rgba(0,0,0,0.15)]',
          )}
          style={{
            width: BALL_SIZE,
            height: BALL_SIZE,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(0,0,0,0.1)',
            opacity: isOpen ? 0 : 1,
            transform: `scale(${isOpen ? 0.45 : 1})`,
            pointerEvents: isOpen ? 'none' : 'auto',
            transition:
              'opacity 0.22s ease, transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.15s ease',
          }}
        >
          {/* Home-button style inner dot */}
          <div
            className="rounded-full bg-black/30 shadow-inner"
            style={{ width: BALL_DOT_SIZE, height: BALL_DOT_SIZE }}
          />
        </div>
      </div>

      {/* ── Space modal ──────────────────────────────────────────────────── */}
      <SpaceModal
        open={spaceOpen}
        onClose={() => setSpaceOpen(false)}
      />

      {/* ── User modal ───────────────────────────────────────────────────── */}
      <UserModal
        open={userOpen}
        onClose={() => setUserOpen(false)}
      />
      {/* ── Snapshot modal ────────────────────────────────────────────── */}
      <SnapshotModal
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
      />

      {/* ── Member modal ────────────────────────────────────────────── */}
      <MemberModal
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
      />

      {/* ── Voice modal ──────────────────────────────────────────────── */}
      <VoiceModal
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
      />

      {/* ── XR welcome modal ─────────────────────────────────────────── */}
      <XRWelcomeModal
        open={xrOpen}
        onClose={() => setXrOpen(false)}
      />
    </>
  );
}
