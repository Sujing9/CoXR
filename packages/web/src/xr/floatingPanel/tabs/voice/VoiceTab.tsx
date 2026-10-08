import { useVoiceStore } from '@/data/voiceStore';
import { useAuthStore } from '@/data/authStore';
import { Plate, Btn, Label } from '../space/primitives';

// ─── Constants ────────────────────────────────────────────────────────────────

const ROW_H = 0.054;
const ROW_GAP = 0.007;
const CTRL_ROW_H = 0.048;
const AVATAR_R = 0.018;

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({
  userId,
  width,
}: {
  userId: string;
  width: number;
}) {
  const participant = useVoiceStore((s) =>
    s.participants.find((p) => p.userId === userId),
  );
  const globalMuted = useVoiceStore((s) => s.globalMuted);
  const toggleLocalMute = useVoiceStore((s) => s.toggleLocalMute);
  const myId = useAuthStore((s) => s.user?.id);

  if (!participant) return null;

  const isSelf = participant.userId === myId;
  const isSpeaking = !!participant.producerId;

  const MUTE_BTN_W = 0.058;
  const avatarCX = -width / 2 + 0.012 + AVATAR_R;
  const nameLX = avatarCX + AVATAR_R + 0.010;
  const actionCX = width / 2 - 0.012 - MUTE_BTN_W / 2;
  const nameRX = !isSelf ? actionCX - MUTE_BTN_W / 2 - 0.008 : width / 2 - 0.014;
  const nameMaxW = nameRX - nameLX;

  // If speaking: name on top, status on bottom; else vertically centered
  const nameY = ROW_H * 0.12;
  const subY = -ROW_H * 0.20;

  // Avatar fill: blue for self, green-ish for speaking, default for others
  const avatarColor = isSelf
    ? 'rgba(80,130,220,0.45)'
    : isSpeaking
      ? 'rgba(60,180,90,0.45)'
      : 'rgba(255,255,255,0.14)';

  return (
    <group>
      <Plate width={width} height={ROW_H} radius={0.010} color="rgba(255,255,255,0.06)" />

      <group position={[0, 0, 0.001]}>
        {/* Avatar */}
        <Plate
          x={avatarCX}
          width={AVATAR_R * 2}
          height={AVATAR_R * 2}
          radius={AVATAR_R}
          color={avatarColor}
        >
          <Label
            text={participant.nickname.charAt(0).toUpperCase()}
            fontSize={AVATAR_R * 0.85}
            color={isSelf ? '#9ab8f0' : isSpeaking ? '#80e0a0' : 'rgba(255,255,255,0.75)'}
          />
        </Plate>

        {/* Nickname */}
        <Label
          x={nameLX}
          y={nameY}
          text={participant.nickname}
          fontSize={0.017}
          color="#fff"
          anchorX="left"
          maxWidth={nameMaxW}
        />

        {/* Self badge / speaking status */}
        <Label
          x={nameLX}
          y={subY}
          text={isSelf ? '我 · ' + (isSpeaking ? '发言中' : '未开麦') : isSpeaking ? '发言中' : '未开麦'}
          fontSize={0.012}
          color={
            isSpeaking
              ? 'rgba(100,220,130,0.90)'
              : 'rgba(255,255,255,0.40)'
          }
          anchorX="left"
        />

        {/* Per-user local mute toggle (others only) */}
        {!isSelf && (
          <Btn
            x={actionCX}
            width={MUTE_BTN_W}
            height={0.036}
            radius={0.008}
            label={participant.localMuted || globalMuted ? '静音中' : '静音'}
            fontSize={0.012}
            variant={participant.localMuted ? 'danger' : 'ghost'}
            disabled={globalMuted}
            onPress={() => toggleLocalMute(participant.userId)}
          />
        )}
      </group>
    </group>
  );
}

// ─── VoiceTab ─────────────────────────────────────────────────────────────────

interface VoiceTabProps {
  width: number;
  height: number;
}

export function VoiceTab({ width, height }: VoiceTabProps) {
  const isConnected = useVoiceStore((s) => s.isConnected);
  const micEnabled = useVoiceStore((s) => s.micEnabled);
  const globalMuted = useVoiceStore((s) => s.globalMuted);
  const participants = useVoiceStore((s) => s.participants);
  const setMicEnabled = useVoiceStore((s) => s.setMicEnabled);
  const setGlobalMuted = useVoiceStore((s) => s.setGlobalMuted);

  // ── Layout ────────────────────────────────────────────────────────────────

  const titleY = height / 2 - 0.022;

  // Status dot + title row
  const DOT_R = 0.006;
  const dotCX = -width / 2 + 0.018 + DOT_R;
  const titleLX = dotCX + DOT_R + 0.010;

  // Controls row: sits below title
  const ctrlRowY = titleY - 0.014 - CTRL_ROW_H / 2;
  const MIC_BTN_W = width * 0.44;
  const MUTE_BTN_W = width * 0.44;
  const micBtnCX = -width / 2 + 0.010 + MIC_BTN_W / 2;
  const muteBtnCX = width / 2 - 0.010 - MUTE_BTN_W / 2;

  // Separator line below controls
  const sepY = ctrlRowY - CTRL_ROW_H / 2 - 0.010;

  // List area: starts just below separator, stacks downward
  const listTopY = sepY - 0.012;
  // First row center: listTopY - ROW_H/2
  const firstRowY = listTopY - ROW_H / 2;

  // Disconnected / empty state
  const noParticipants = participants.length === 0;
  const listMidY = -height / 2 + (listTopY - (-height / 2)) / 2;

  return (
    <group>
      {/* ── Title row ─────────────────────────────────────────────────────── */}
      <group position={[0, titleY, 0]}>
        {/* Connection status dot */}
        <Plate
          x={dotCX}
          width={DOT_R * 2}
          height={DOT_R * 2}
          radius={DOT_R}
          color={isConnected ? 'rgba(60,200,100,0.90)' : 'rgba(255,255,255,0.25)'}
        />
        <Label
          x={titleLX}
          text="语音通话"
          fontSize={0.020}
          color="#fff"
          anchorX="left"
        />
      </group>

      {/* ── Controls row ──────────────────────────────────────────────────── */}
      <group position={[0, ctrlRowY, 0]}>
        {/* Mic toggle */}
        <Btn
          x={micBtnCX}
          width={MIC_BTN_W}
          height={CTRL_ROW_H}
          radius={0.010}
          label={micEnabled ? '麦克风已开' : '打开麦克风'}
          fontSize={0.015}
          variant={micEnabled ? 'primary' : 'ghost'}
          disabled={!isConnected}
          onPress={() => setMicEnabled(!micEnabled)}
        />

        {/* Global mute toggle */}
        <Btn
          x={muteBtnCX}
          width={MUTE_BTN_W}
          height={CTRL_ROW_H}
          radius={0.010}
          label={globalMuted ? '已全局静音' : '正在收听'}
          fontSize={0.015}
          variant={globalMuted ? 'danger' : 'ghost'}
          disabled={!isConnected}
          onPress={() => setGlobalMuted(!globalMuted)}
        />
      </group>

      {/* ── Separator ─────────────────────────────────────────────────────── */}
      <group position={[0, sepY, 0]}>
        <Plate
          width={width}
          height={0.0015}
          radius={0.0007}
          color="rgba(255,255,255,0.12)"
        />
      </group>

      {/* ── Participant list ───────────────────────────────────────────────── */}
      {!isConnected ? (
        <Label
          y={listMidY}
          text="正在连接语音服务…"
          fontSize={0.016}
          color="rgba(255,255,255,0.38)"
        />
      ) : noParticipants ? (
        <Label
          y={listMidY}
          text="暂无参与者"
          fontSize={0.016}
          color="rgba(255,255,255,0.38)"
        />
      ) : (
        <group>
          {participants.map((p, i) => (
            <group
              key={p.userId}
              position={[0, firstRowY - i * (ROW_H + ROW_GAP), 0]}
            >
              <ParticipantRow userId={p.userId} width={width} />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
