import type { ComponentType } from 'react';
import { Container, type SvgProperties } from '@react-three/uikit';
import {
  Blocks,
  User as UserIcon,
  LogOut,
  PanelLeft,
  Users,
  History,
  Mic,
} from '@react-three/uikit-lucide';
import { useXR } from '@react-three/xr';
import { useSpaceStore } from '@/data/spaceStore';
import { useXRSystemPanelStore, type XRSystemTab } from '../xrSystemPanelStore';
import {
  CARD_BG,
  CARD_BORDER,
  SELECTED_BG,
  HOVER_BG,
  RIGHT_COLUMN_PX,
} from './systemPanelTheme';

const BUTTON_SIZE = 36;
const BUTTON_RADIUS = 12;
const ICON_SIZE = 16;

interface MenuIconProps {
  Icon: ComponentType<SvgProperties>;
  isActive?: boolean;
  onPress: () => void;
}

function MenuIcon({ Icon, isActive, onPress }: MenuIconProps) {
  return (
    <Container
      width={BUTTON_SIZE}
      height={BUTTON_SIZE}
      borderRadius={BUTTON_RADIUS}
      backgroundColor={isActive ? SELECTED_BG : 'transparent'}
      hover={{ backgroundColor: isActive ? SELECTED_BG : HOVER_BG }}
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      onPointerDown={(e) => {
        e.stopPropagation();
        onPress();
      }}
    >
      <Icon
        width={ICON_SIZE}
        height={ICON_SIZE}
        color={isActive ? '#000' : '#111'}
        pointerEvents="none"
      />
    </Container>
  );
}

interface TabEntry {
  tab: XRSystemTab;
  Icon: ComponentType<SvgProperties>;
}

const STATIC_TABS: TabEntry[] = [
  { tab: 'space', Icon: Blocks },
  { tab: 'account', Icon: UserIcon },
];

const DYNAMIC_TABS: TabEntry[] = [
  { tab: 'panel', Icon: PanelLeft },
  { tab: 'members', Icon: Users },
  { tab: 'snapshot', Icon: History },
  { tab: 'voice', Icon: Mic },
];

/**
 * 系统面板右栏菜单。完全对齐 archived `SystemPanelContent` 右侧 Container。
 */
export function SystemMenu() {
  const activeTab = useXRSystemPanelStore((s) => s.activeTab);
  const setTab = useXRSystemPanelStore((s) => s.setTab);
  const activeSpace = useSpaceStore((s) => s.activeSpace);
  const session = useXR((s) => s.session);

  const tabs = activeSpace ? [...STATIC_TABS, ...DYNAMIC_TABS] : STATIC_TABS;

  const leaveXR = () => {
    session?.end().catch(() => undefined);
  };

  return (
    <Container
      width={RIGHT_COLUMN_PX}
      height="100%"
      backgroundColor={CARD_BG}
      borderWidth={1}
      borderColor={CARD_BORDER}
      borderRadius={18}
      paddingY={10}
      paddingX={10}
      flexDirection="column"
      alignItems="center"
      justifyContent="space-between"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Container flexDirection="column" gap={8} alignItems="center">
        {tabs.map(({ tab, Icon }) => (
          <MenuIcon
            key={tab}
            Icon={Icon}
            isActive={activeTab === tab}
            onPress={() => setTab(tab)}
          />
        ))}
      </Container>

      <MenuIcon Icon={LogOut} onPress={leaveXR} />
    </Container>
  );
}
