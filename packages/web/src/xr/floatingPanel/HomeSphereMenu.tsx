import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Container, type SvgProperties } from '@react-three/uikit';
import { Text as DreiText } from '@react-three/drei';
import { MathUtils, type Group } from 'three';
import { Maximize, ZoomIn, CornerDownLeft, Move, X } from '@react-three/uikit-lucide';
import { FONTS } from '@/constants/world';
import { useXRPanelUIStore } from '../xrPanelUIStore';

const MENU_BG = 'rgba(255, 255, 255, 0.9)';
const PIXEL = 0.002; // 1px = 2mm
const MENU_HEIGHT = 0.07;
const BUTTON_SIZE = 0.04;

const TOOLTIP_FONT_SIZE = 0.024; // 调大字体
const TOOLTIP_PAD_X = 0.016;
const TOOLTIP_PAD_Y = 0.01;

interface HomeSphereMenuProps {
    /** 在面板坐标系下的本地 Y（菜单中心位置） */
    localY: number;
}

function clamp01(v: number) {
    return Math.min(1, Math.max(0, v));
}
function easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
}

interface MenuButtonProps {
    Icon: React.ComponentType<SvgProperties>;
    label: string;
    active?: boolean;
    onHover: (label: string | null) => void;
    onPress: () => void;
}

function MenuButton({ Icon, label, active, onHover, onPress }: MenuButtonProps) {
    return (
        <Container
            sizeX={BUTTON_SIZE}
            sizeY={BUTTON_SIZE}
            borderRadius={999}
            alignItems="center"
            justifyContent="center"
            backgroundColor={active ? 'rgba(0,0,0,0.15)' : 'transparent'}
            hover={{ backgroundColor: 'rgba(0,0,0,0.08)' }}
            onPointerEnter={(e) => {
                e.stopPropagation();
                onHover(label);
            }}
            onPointerLeave={(e) => {
                e.stopPropagation();
                onHover(null);
            }}
            onPointerDown={(e) => {
                e.stopPropagation();
                onPress();
            }}
        >
            <Icon color="#111" pointerEvents="none" width={16} height={16} />
        </Container>
    );
}

/** 中文 tooltip：drei Text + 药丸背板（mesh），避免 uikit 中文图集问题。 */
function Tooltip({ text, y }: { text: string; y: number }) {
    // 估算药丸宽度（中文 ≈ 1em，西文/数字 ≈ 0.6em）
    const widthEm = useMemo(() => {
        let em = 0;
        for (const ch of text) em += /[\u4e00-\u9fff]/.test(ch) ? 1 : 0.6;
        return Math.max(em, 1);
    }, [text]);
    const pillW = widthEm * TOOLTIP_FONT_SIZE + TOOLTIP_PAD_X * 2;
    const pillH = TOOLTIP_FONT_SIZE + TOOLTIP_PAD_Y * 2;

    return (
        <group position={[0, y, 0]} renderOrder={20}>
            <mesh>
                <planeGeometry args={[pillW, pillH]} />
                <meshBasicMaterial
                    color="#ffffff"
                    transparent
                    opacity={0.95}
                    depthWrite={false}
                    toneMapped={false}
                />
            </mesh>
            <DreiText
                font={FONTS.DEFAULT}
                fontSize={TOOLTIP_FONT_SIZE}
                color="#000000"
                anchorX="center"
                anchorY="middle"
                position={[0, 0, 0.001]}
                fontWeight="bold"
            >
                {text}
            </DreiText>
        </group>
    );
}

/**
 * 小球点击展开的工具菜单。
 * 三个按钮：调整大小 / 缩放 / 返回（关闭菜单）。
 */
export function HomeSphereMenu({ localY }: HomeSphereMenuProps) {
    const open = useXRPanelUIStore((s) => s.menuOpen);
    const closeMenu = useXRPanelUIStore((s) => s.closeMenu);
    const resizing = useXRPanelUIStore((s) => s.resizing);
    const scaling = useXRPanelUIStore((s) => s.scaling);
    const toggleResizing = useXRPanelUIStore((s) => s.toggleResizing);
    const toggleScaling = useXRPanelUIStore((s) => s.toggleScaling);

    const [tooltip, setTooltip] = useState<string | null>(null);

    const rootRef = useRef<Group>(null);
    const animRef = useRef({ from: 0, to: 0, start: 0, duration: 200, value: 0 });
    const prevOpenRef = useRef(open);

    useFrame(() => {
        const now = performance.now();
        if (prevOpenRef.current !== open) {
            prevOpenRef.current = open;
            animRef.current.from = animRef.current.value;
            animRef.current.to = open ? 1 : 0;
            animRef.current.start = now;
            animRef.current.duration = open ? 200 : 150;
        }
        const a = animRef.current;
        const t = clamp01((now - a.start) / a.duration);
        const eased = easeOutCubic(t);
        a.value = a.from + (a.to - a.from) * eased;

        const root = rootRef.current;
        if (root) {
            root.scale.setScalar(MathUtils.lerp(0.6, 1, a.value));
            root.visible = a.value > 0.001;
        }
        if (!open && t >= 1 && a.value <= 0.001 && tooltip) setTooltip(null);
    });

    const buttons = useMemo(
        () => [
            {
                key: 'main-no-close',
                Icon: X,
                label: '主窗口无法关闭',
            },
            {
                key: 'resize',
                Icon: Maximize,
                label: '调整大小',
                active: resizing,
                action: () => toggleResizing(),
            },
            {
                key: 'move',
                Icon: Move,
                label: '移动',
                action: () => closeMenu(),
            },
            {
                key: 'scale',
                Icon: ZoomIn,
                label: '缩放',
                active: scaling,
                action: () => toggleScaling(),
            },
            {
                key: 'close-menu',
                Icon: CornerDownLeft,
                label: '返回',
                action: () => closeMenu(),
            },
        ],
        [scaling, resizing, closeMenu, toggleScaling, toggleResizing],
    );

    return (
        <group
            ref={rootRef}
            position={[0, localY, 0]}
            visible={open}
            onPointerDown={(e) => e.stopPropagation()}
        >
            {/* Tooltip */}
            {tooltip ? <Tooltip text={tooltip} y={-MENU_HEIGHT / 2 - 0.03} /> : null}

            {/* Menu bar */}
            <Container
                sizeY={MENU_HEIGHT}
                pixelSize={PIXEL}
                paddingX={12}
                paddingY={10}
                gapColumn={6}
                borderRadius={18}
                backgroundColor={MENU_BG}
                borderWidth={1}
                borderColor="rgba(0,0,0,0.15)"
                flexDirection="row"
                alignItems="center"
                justifyContent="center"
                gap={10}
            >
                {buttons.map((b) => (
                    <MenuButton
                        key={b.key}
                        Icon={b.Icon}
                        label={b.label}
                        active={b.active}
                        onHover={(l) => setTooltip(l)}
                        onPress={b.action ?? (() => { })}
                    />
                ))}
            </Container>
        </group>
    );
}
