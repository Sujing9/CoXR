import { Dialog } from 'radix-ui';
import {
  XIcon,
  MicIcon,
  MicOffIcon,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVoiceStore } from '../data/voiceStore';
import { useAuthStore } from '../data/authStore';

// ─── ParticipantRow ───────────────────────────────────────────────────────────

function ParticipantRow({ userId }: { userId: string }) {
  const participant = useVoiceStore((s) =>
    s.participants.find((p) => p.userId === userId),
  );
  const globalMuted = useVoiceStore((s) => s.globalMuted);
  const toggleLocalMute = useVoiceStore((s) => s.toggleLocalMute);
  const myId = useAuthStore((s) => s.user?.id);

  if (!participant) return null;

  const isSelf = participant.userId === myId;
  const isMuted = globalMuted || participant.localMuted;
  const isSpeaking = !!participant.producerId;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-black/5 px-4 py-3.5 shadow-sm">
      {/* Avatar */}
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-black font-black text-sm shadow-sm ring-1 ring-black/5 select-none uppercase">
        {participant.nickname.slice(0, 1)}
        {/* Speaking indicator */}
        {isSpeaking && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-green-500 ring-2 ring-white shadow-sm shadow-green-500/30 animate-pulse" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-black text-black">
            {participant.nickname}
          </span>
          {isSelf && (
            <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-black text-white shadow-md shadow-indigo-600/20">
              ME
            </span>
          )}
        </div>
        <p className={cn(
          "text-[10px] font-bold uppercase tracking-wider",
          isSpeaking ? "text-green-600" : "text-black/30"
        )}>
          {isSpeaking ? 'Speaking' : 'Muted'}
        </p>
      </div>

      {/* Per-user mute button (only for others) */}
      {!isSelf && (
        <button
          onClick={() => toggleLocalMute(participant.userId)}
          title={participant.localMuted ? '取消静音' : '静音'}
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl transition-all shadow-sm',
            participant.localMuted
              ? 'bg-red-600 text-white shadow-red-600/20'
              : 'bg-white text-black/40 ring-1 ring-black/10 hover:bg-black/5',
          )}
        >
          {participant.localMuted ? <VolumeXIcon size={16} strokeWidth={2.5} /> : <Volume2Icon size={16} strokeWidth={2.5} />}
        </button>
      )}
    </div>
  );
}

// ─── VoiceModal ───────────────────────────────────────────────────────────────

interface VoiceModalProps {
  open: boolean;
  onClose: () => void;
}

export function VoiceModal({ open, onClose }: VoiceModalProps) {
  const { isConnected, micEnabled, globalMuted, participants } = useVoiceStore();
  const { setMicEnabled, setGlobalMuted } = useVoiceStore();

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-200"
        />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 duration-200"
        >
        <div className="w-[min(92vw,400px)] rounded-3xl border border-black/10 bg-white shadow-2xl flex flex-col overflow-hidden text-black">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-black/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <MicIcon size={20} strokeWidth={2.5} className="text-black/30" />
              <Dialog.Title className="text-base font-black text-black">
                语音通话
              </Dialog.Title>
              {/* Connection status dot */}
              <span
                className={cn(
                  'size-2 rounded-full',
                  isConnected ? 'bg-green-500 shadow-sm shadow-green-500/40' : 'bg-black/10',
                )}
              />
            </div>
            <Dialog.Close asChild>
              <button className="flex size-9 items-center justify-center rounded-xl text-black/40 transition-colors hover:bg-black/5 hover:text-black">
                <XIcon size={20} strokeWidth={2.5} />
              </button>
            </Dialog.Close>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 border-b border-black/5 px-6 py-5 bg-black/[0.02]">
            {/* Mic toggle */}
            <button
              onClick={() => setMicEnabled(!micEnabled)}
              disabled={!isConnected}
              className={cn(
                'flex-1 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all shadow-md',
                micEnabled
                  ? 'bg-indigo-600 text-white shadow-indigo-600/20'
                  : 'bg-white text-black/60 ring-1 ring-black/10 hover:bg-black/5',
                !isConnected && 'cursor-not-allowed opacity-40',
              )}
            >
              {micEnabled ? <MicIcon size={16} strokeWidth={2.5} /> : <MicOffIcon size={16} strokeWidth={2.5} />}
              {micEnabled ? '麦克风已开' : '打开麦克风'}
            </button>

            {/* Global mute toggle */}
            <button
              onClick={() => setGlobalMuted(!globalMuted)}
              disabled={!isConnected}
              className={cn(
                'flex-1 flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-black transition-all shadow-md',
                globalMuted
                  ? 'bg-red-600 text-white shadow-red-600/20'
                  : 'bg-white text-black/60 ring-1 ring-black/10 hover:bg-black/5',
                !isConnected && 'cursor-not-allowed opacity-40',
              )}
            >
              {globalMuted ? <VolumeXIcon size={16} strokeWidth={2.5} /> : <Volume2Icon size={16} strokeWidth={2.5} />}
              {globalMuted ? '已全局静音' : '正在收听'}
            </button>
          </div>

          {/* Participant list */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-[200px] max-h-[400px]">
            {!isConnected ? (
              <p className="py-12 text-center text-sm font-bold text-black/30">正在连接通话服务...</p>
            ) : participants.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 text-black/20">
                <MicIcon size={40} strokeWidth={1} />
                <p className="text-sm font-bold">房间内暂无其他参与者</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {participants.map((p) => (
                  <ParticipantRow key={p.userId} userId={p.userId} />
                ))}
              </div>
            )}
          </div>
        </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
