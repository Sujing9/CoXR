import { useState } from 'react';
import { useAuthStore } from '@/data/authStore';
import { clearToken } from '@/api/client';
import { Plate, Btn, Label } from '../space/primitives';

interface AccountTabProps {
  width: number;
  height: number;
}

export function AccountTab({ width, height }: AccountTabProps) {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLogout = () => {
    clearToken();
    setUser(null);
    window.location.reload();
  };

  if (showConfirm) {
    return (
      <group>
        <Plate x={0} y={0} width={width * 0.8} height={height * 0.4} color="rgba(255,255,255,0.98)" radius={0.02}>
          <Label y={0.04} text="确定要退出当前账户吗？" fontSize={0.03} color="#111" />

          <group position={[0, -0.06, 0.001]}>
            <Btn
              x={-width * 0.18}
              width={width * 0.3}
              height={0.056}
              label="取消"
              variant="ghost"
              onPress={() => setShowConfirm(false)}
            />
            <Btn
              x={width * 0.18}
              width={width * 0.3}
              height={0.056}
              label="确认退出"
              variant="danger"
              onPress={handleLogout}
            />
          </group>
        </Plate>
      </group>
    );
  }

  const cardW = width * 0.85;
  const cardH = height * 0.6;
  const cardY = height * 0.08;

  const avatarSize = Math.min(width, height) * 0.25;
  const avatarY = cardH / 2 - avatarSize / 2 - 0.05;
  const nameY = avatarY - avatarSize / 2 - 0.05;
  const nickY = nameY - 0.035;

  const btnW = width * 0.85;
  const btnH = 0.056;
  const btnY = -(height / 2 - btnH / 2 - 0.04);

  return (
    <group>
      {/* 标题 */}
      <Label
        x={-width / 2 + 0.04}
        y={height / 2 - 0.036}
        text="账户中心"
        fontSize={0.034}
        anchorX="left"
        color="#000000"
      />

      {/* 个人资料卡片 */}
      <Plate x={0} y={cardY} width={cardW} height={cardH} color="rgba(0,0,0,0.04)" radius={0.02}>
        {/* 头像 (用首字母代替) */}
        <Plate x={0} y={avatarY} width={avatarSize} height={avatarSize} radius={avatarSize / 2} color="rgba(0,0,0,0.08)">
          <Label text={user?.nickname?.charAt(0).toUpperCase() ?? '?'} fontSize={avatarSize * 0.5} y={0.002} color="#111" />
        </Plate>

        <Label y={nameY} text={user?.nickname ?? '—'} fontSize={0.038} color="#000" />
        <Label y={nickY} text={`@${user?.username ?? '—'}`} fontSize={0.022} color="#444" />
      </Plate>

      {/* 退出登录按钮 */}
      <Btn
        x={0}
        y={btnY}
        width={btnW}
        height={btnH}
        label="退出登录"
        fontSize={0.026}
        variant="danger"
        onPress={() => setShowConfirm(true)}
      />
    </group>
  );
}
