import { Text as DreiText } from '@react-three/drei';
import { FONTS } from '@/constants/world';
import { useXRSystemPanelStore, type XRSystemTab } from '../xrSystemPanelStore';
import { SpaceTab } from './tabs/space/SpaceTab';
import { AccountTab } from './tabs/account/AccountTab';
import { MemberTab } from './tabs/members/MemberTab';
import { SnapshotTab } from './tabs/snapshot/SnapshotTab';
import { VoiceTab } from './tabs/voice/VoiceTab';
import { PanelTab } from './tabs/panel/PanelTab';


const TAB_LABELS: Record<XRSystemTab, string> = {
  space: '空间管理',
  account: '账户设置',
  panel: '面板',
  members: '成员管理',
  snapshot: '快照管理',
  voice: '语音通话',
};

const TAB_DESCRIPTIONS: Record<XRSystemTab, string> = {
  space: '此处将展示空间列表与新建/切换空间的入口',
  account: '此处将展示当前账户信息与登录设置',
  panel: '此处将展示当前空间内的子面板导航',
  members: '此处将展示成员列表与权限管理',
  snapshot: '此处将展示快照历史与回滚操作',
  voice: '此处将展示语音通话的成员状态与控制',
};

interface TabContentProps {
  /** 内容区域中心在面板局部坐标的 x（避开右栏菜单） */
  centerX: number;
  /** 左卡内容区可用宽（米，已扣除左卡 padding） */
  contentWidth: number;
  /** 左卡内容区可用高（米，已扣除左卡 padding） */
  contentHeight: number;
}

/** 各 tab 的 3D 内容（drei Text + FONTS.DEFAULT 渲染中文）。 */
export function TabContent({ centerX, contentWidth, contentHeight }: TabContentProps) {
  const activeTab = useXRSystemPanelStore((s) => s.activeTab);

  return (
    <group position={[centerX, 0, 0.001]}>
      {activeTab === 'space' ? (
        <SpaceTab width={contentWidth} height={contentHeight} />
      ) : activeTab === 'account' ? (
        <AccountTab width={contentWidth} height={contentHeight} />
      ) : activeTab === 'members' ? (
        <MemberTab width={contentWidth} height={contentHeight} />
      ) : activeTab === 'snapshot' ? (
        <SnapshotTab width={contentWidth} height={contentHeight} />
      ) : activeTab === 'voice' ? (
        <VoiceTab width={contentWidth} height={contentHeight} />
      ) : activeTab === 'panel' ? (
        <PanelTab width={contentWidth} height={contentHeight} />
      ) : (
        <Placeholder activeTab={activeTab} />
      )}
    </group>
  );
}

function Placeholder({ activeTab }: { activeTab: XRSystemTab }) {
  const label = TAB_LABELS[activeTab];
  const desc = TAB_DESCRIPTIONS[activeTab];
  return (
    <group>
      <DreiText
        font={FONTS.DEFAULT}
        fontSize={0.045}
        color="#111111"
        anchorX="center"
        anchorY="middle"
        position={[0, 0.04, 0]}
        fontWeight="bold"
      >
        {label}
      </DreiText>
      <DreiText
        font={FONTS.DEFAULT}
        fontSize={0.02}
        color="#333333"
        anchorX="center"
        anchorY="middle"
        maxWidth={0.36}
        position={[0, -0.02, 0]}
        fontWeight="medium"
      >
        {desc}
      </DreiText>
    </group>
  );
}
