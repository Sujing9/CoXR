/**
 * useVoiceManager
 *
 * 挂载在 PCShell 中的生命周期 hook。
 * - 监听 activeSpace：有值 → 建立 Voice WebSocket + mediasoup Device → 自动订阅所有参与者
 * - activeSpace → null：断开所有连接，重置 voiceStore
 * - 监听 micEnabled：变化时创建/关闭 Producer
 * - Audio 元素通过 ref map 管理，localMuted / globalMuted 直接控制 audio.muted
 */

import { useEffect, useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';
import type {
  Transport,
  Producer,
  Consumer,
} from 'mediasoup-client/types';
import { useSpaceStore } from '../data/spaceStore';
import { useAuthStore } from '../data/authStore';
import { useVoiceStore } from '../data/voiceStore';
import { getToken } from '../api/client';

// ─── Local mirror of the server-side ParticipantInfo type ────────────────────
interface ParticipantInfo {
  userId: string;
  nickname: string;
  producerId: string | null;
}

const WS_BASE =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined) ??
  'ws://localhost:3000';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceManager() {
  const { activeSpace } = useSpaceStore();
  const { user } = useAuthStore();
  const store = useVoiceStore();

  // ── Refs (stable across renders) ─────────────────────────────────────────
  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producerRef = useRef<Producer | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  /** userId → HTMLAudioElement */
  const audioEls = useRef<Map<string, HTMLAudioElement>>(new Map());
  /** requestId → { resolve, reject } */
  const pendingRef = useRef<Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>>(new Map());
  const spaceIdRef = useRef<string | null>(null);

  // ── RPC send helper ───────────────────────────────────────────────────────

  const rpc = useCallback(
    <T>(msg: object): Promise<T> =>
      new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket not open'));
          return;
        }
        const requestId = crypto.randomUUID();
        pendingRef.current.set(requestId, {
          resolve: resolve as (v: unknown) => void,
          reject,
        });
        ws.send(JSON.stringify({ ...msg, requestId }));
        // Timeout safety
        setTimeout(() => {
          if (pendingRef.current.has(requestId)) {
            pendingRef.current.delete(requestId);
            reject(new Error('RPC timeout'));
          }
        }, 15000);
      }),
    [],
  );

  // ── Create/attach audio element ───────────────────────────────────────────

  const attachAudio = useCallback((userId: string, stream: MediaStream) => {
    let el = audioEls.current.get(userId);
    if (!el) {
      el = document.createElement('audio');
      el.autoplay = true;
      document.body.appendChild(el);
      audioEls.current.set(userId, el);
    }
    el.srcObject = stream;
    // Sync initial muted state
    const s = useVoiceStore.getState();
    const participant = s.participants.find((p) => p.userId === userId);
    el.muted = s.globalMuted || (participant?.localMuted ?? false);
  }, []);

  const removeAudio = useCallback((userId: string) => {
    const el = audioEls.current.get(userId);
    if (el) {
      el.srcObject = null;
      el.remove();
      audioEls.current.delete(userId);
    }
  }, []);

  // ── Consume a producer ────────────────────────────────────────────────────

  const consumeProducer = useCallback(
    async (info: ParticipantInfo) => {
      if (!info.producerId) return;
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      try {
        const res = await rpc<{
          id: string;
          producerId: string;
          kind: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rtpParameters: any;
          requestId: string;
        }>({
          type: 'consume',
          producerId: info.producerId,
          rtpCapabilities: device.rtpCapabilities,
        });

        const consumer: Consumer = await recvTransport.consume({
          id: res.id,
          producerId: res.producerId,
          kind: res.kind as 'audio',
          rtpParameters: res.rtpParameters,
        });

        await rpc({ type: 'resumeConsumer', consumerId: consumer.id });

        const stream = new MediaStream([consumer.track]);
        attachAudio(info.userId, stream);

        useVoiceStore.getState().setParticipantConsumerId(info.userId, consumer.id);
        useVoiceStore.getState().upsertParticipant({
          userId: info.userId,
          nickname: info.nickname,
          producerId: info.producerId,
        });

        consumer.on('transportclose', () => removeAudio(info.userId));
      } catch (e) {
        console.error('[Voice] consume error:', e);
      }
    },
    [rpc, attachAudio, removeAudio],
  );

  // ── Connect ───────────────────────────────────────────────────────────────

  const connect = useCallback(
    async (spaceId: string) => {
      const token = getToken();
      if (!token) return;

      spaceIdRef.current = spaceId;

      const ws = new WebSocket(
        `${WS_BASE}/voice?token=${encodeURIComponent(token)}&spaceId=${encodeURIComponent(spaceId)}`,
      );
      wsRef.current = ws;

      ws.onopen = async () => {
        try {
          // 1. 获取 router RTP capabilities
          const { rtpCapabilities } = await rpc<{ rtpCapabilities: object; requestId: string }>({
            type: 'getRouterRtpCapabilities',
          });

          // 2. 初始化 Device
          const device = new Device();
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          deviceRef.current = device;

          // 3. 创建 recv transport
          const recvParams = await rpc<{
            id: string;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            iceParameters: any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            iceCandidates: any[];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            dtlsParameters: any;
            requestId: string;
          }>({ type: 'createTransport', direction: 'recv' });

          const recvTransport = device.createRecvTransport({
            id: recvParams.id,
            iceParameters: recvParams.iceParameters,
            iceCandidates: recvParams.iceCandidates,
            dtlsParameters: recvParams.dtlsParameters,
          });
          recvTransportRef.current = recvTransport;

          recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            try {
              await rpc({ type: 'connectTransport', transportId: recvTransport.id, dtlsParameters });
              callback();
            } catch (e) {
              errback(e as Error);
            }
          });

          // 4. 获取当前参与者列表
          const { participants } = await rpc<{
            participants: ParticipantInfo[];
            requestId: string;
          }>({ type: 'getParticipants' });

          const myUserId = user?.id ?? '';

          // 设置参与者列表（排除自己）
          const others = participants.filter((p) => p.userId !== myUserId);
          useVoiceStore.getState().setParticipants(
            others.map((p) => ({ ...p, localMuted: false })),
          );

          // 把自己也加入（无 producerId）
          if (user) {
            useVoiceStore.getState().upsertParticipant({
              userId: user.id,
              nickname: user.nickname,
              producerId: null,
            });
          }

          // 5. 逐一消费其他参与者的音频（默认收听）
          for (const p of others) {
            if (p.producerId) {
              await consumeProducer(p);
            }
          }

          store.setConnected(true);
        } catch (e) {
          console.error('[Voice] connect setup error:', e);
          ws.close();
        }
      };

      ws.onmessage = async (evt) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(evt.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        // ── Handle RPC responses ─────────────────────────────────────────
        if (msg.requestId) {
          const pending = pendingRef.current.get(msg.requestId as string);
          if (pending) {
            pendingRef.current.delete(msg.requestId as string);
            if (msg.type === 'error') {
              pending.reject(new Error(msg.message as string));
            } else {
              pending.resolve(msg);
            }
            return;
          }
        }

        // ── Handle push events ───────────────────────────────────────────
        const myUserId = user?.id ?? '';

        if (msg.type === 'participantJoined') {
          const info = msg.participant as ParticipantInfo;
          if (info.userId === myUserId) return;
          useVoiceStore.getState().upsertParticipant({
            userId: info.userId,
            nickname: info.nickname,
            producerId: info.producerId,
          });
          if (info.producerId) {
            await consumeProducer(info);
          }
        } else if (msg.type === 'participantLeft') {
          const userId = msg.userId as string;
          useVoiceStore.getState().removeParticipant(userId);
          removeAudio(userId);
        } else if (msg.type === 'producerClosed') {
          const userId = msg.userId as string;
          useVoiceStore.getState().setParticipantProducerId(userId, null);
          removeAudio(userId);
        }
      };

      ws.onclose = () => {
        store.setConnected(false);
      };
    },
    [rpc, consumeProducer, removeAudio, store, user],
  );

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(async () => {
    // Stop mic
    const producer = producerRef.current;
    if (producer) {
      producerRef.current = null;
      try {
        await rpc({ type: 'closeProducer', producerId: producer.id });
      } catch { /* ignore */ }
      producer.close();
    }

    // Stop local stream tracks
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    // Close transports
    sendTransportRef.current?.close();
    sendTransportRef.current = null;
    recvTransportRef.current?.close();
    recvTransportRef.current = null;

    // Remove all audio elements
    for (const userId of audioEls.current.keys()) {
      removeAudio(userId);
    }

    // Close WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    deviceRef.current = null;
    spaceIdRef.current = null;

    store.reset();
  }, [rpc, removeAudio, store]);

  // ── Enable mic ────────────────────────────────────────────────────────────

  const enableMic = useCallback(async () => {
    const device = deviceRef.current;
    if (!device) return;

    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // Create send transport if not exists
      if (!sendTransportRef.current) {
        const sendParams = await rpc<{
          id: string;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          iceParameters: any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          iceCandidates: any[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          dtlsParameters: any;
          requestId: string;
        }>({ type: 'createTransport', direction: 'send' });

        const sendTransport = device.createSendTransport({
          id: sendParams.id,
          iceParameters: sendParams.iceParameters,
          iceCandidates: sendParams.iceCandidates,
          dtlsParameters: sendParams.dtlsParameters,
        });
        sendTransportRef.current = sendTransport;

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await rpc({ type: 'connectTransport', transportId: sendTransport.id, dtlsParameters });
            callback();
          } catch (e) {
            errback(e as Error);
          }
        });

        sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const { id } = await rpc<{ id: string; requestId: string }>({
              type: 'produce',
              transportId: sendTransport.id,
              kind,
              rtpParameters,
            });
            callback({ id });
          } catch (e) {
            errback(e as Error);
          }
        });
      }

      const audioTrack = stream.getAudioTracks()[0];
      const producer = await sendTransportRef.current.produce({ track: audioTrack });
      producerRef.current = producer;

      // Update self producerId in store
      if (user) {
        useVoiceStore.getState().setParticipantProducerId(user.id, producer.id);
      }
    } catch (e) {
      console.error('[Voice] enableMic error:', e);
      stream?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
  }, [rpc, user]);

  // ── Disable mic ───────────────────────────────────────────────────────────

  const disableMic = useCallback(async () => {
    if (producerRef.current) {
      try {
        await rpc({ type: 'closeProducer', producerId: producerRef.current.id });
      } catch { /* ignore */ }
      producerRef.current.close();
      producerRef.current = null;
    }
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    if (user) {
      useVoiceStore.getState().setParticipantProducerId(user.id, null);
    }
  }, [rpc, user]);

  // ── Lifecycle: connect/disconnect on activeSpace change ───────────────────

  useEffect(() => {
    if (!activeSpace) return;
    connect(activeSpace.id);
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSpace?.id]);

  // ── Lifecycle: mic toggle ─────────────────────────────────────────────────

  useEffect(() => {
    if (!store.isConnected) return;
    if (store.micEnabled) {
      enableMic();
    } else {
      disableMic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.micEnabled, store.isConnected]);

  // ── Sync audio muted state when globalMuted or participants change ─────────

  useEffect(() => {
    for (const p of store.participants) {
      const el = audioEls.current.get(p.userId);
      if (el) {
        el.muted = store.globalMuted || p.localMuted;
      }
    }
  }, [store.globalMuted, store.participants]);
}
