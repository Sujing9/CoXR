/**
 * VoiceRoomManager — mediasoup SFU 房间管理器
 *
 * 单例模式：持有一个 mediasoup Worker，每个 spaceId 对应一个 VoiceRoom。
 * 每个 VoiceRoom 含有一个 Router，以及所有 peer 的 Transport / Producer。
 */

import * as mediasoup from 'mediasoup';
import type {
  Worker,
  Router,
  WebRtcTransport,
  Producer,
  Consumer,
} from 'mediasoup/types';
import { env } from '../env.js';
import type { ParticipantInfo } from './types.js';

// ─── Audio codec capabilities ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AUDIO_CODECS: any[] = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
];

// ─── Peer state ───────────────────────────────────────────────────────────────

interface PeerState {
  userId: string;
  nickname: string;
  /** Underlying WebSocket send function */
  send: (data: string) => void;
  sendTransport: WebRtcTransport | null;
  recvTransport: WebRtcTransport | null;
  producer: Producer | null;
  /** consumerId → Consumer */
  consumers: Map<string, Consumer>;
}

// ─── VoiceRoom ────────────────────────────────────────────────────────────────

class VoiceRoom {
  readonly spaceId: string;
  readonly router: Router;
  /** userId → PeerState */
  private peers = new Map<string, PeerState>();

  constructor(spaceId: string, router: Router) {
    this.spaceId = spaceId;
    this.router = router;
  }

  // ── Peer lifecycle ──────────────────────────────────────────────────────────

  addPeer(userId: string, nickname: string, send: (data: string) => void) {
    if (!this.peers.has(userId)) {
      this.peers.set(userId, {
        userId,
        nickname,
        send,
        sendTransport: null,
        recvTransport: null,
        producer: null,
        consumers: new Map(),
      });
    } else {
      // Reconnect: update send function
      const peer = this.peers.get(userId)!;
      peer.send = send;
      peer.nickname = nickname;
    }
  }

  async removePeer(userId: string): Promise<string | null> {
    const peer = this.peers.get(userId);
    if (!peer) return null;

    const producerId = peer.producer?.id ?? null;

    // Close consumers first
    for (const consumer of peer.consumers.values()) {
      consumer.close();
    }
    peer.recvTransport?.close();
    peer.producer?.close();
    peer.sendTransport?.close();

    this.peers.delete(userId);

    // Notify remaining peers if there was a producer
    if (producerId) {
      this.broadcast(
        JSON.stringify({ type: 'producerClosed', producerId, userId }),
        userId,
      );
    }

    // Notify remaining peers that this participant left
    this.broadcast(JSON.stringify({ type: 'participantLeft', userId }), userId);

    return producerId;
  }

  hasPeer(userId: string): boolean {
    return this.peers.has(userId);
  }

  isEmpty(): boolean {
    return this.peers.size === 0;
  }

  getPeer(userId: string): PeerState | undefined {
    return this.peers.get(userId);
  }

  // ── Transport ───────────────────────────────────────────────────────────────

  async createWebRtcTransport(
    userId: string,
    direction: 'send' | 'recv',
  ): Promise<WebRtcTransport> {
    const transport = await this.router.createWebRtcTransport({
      listenIps: [
        {
          ip: env.MEDIASOUP_LISTEN_IP,
          announcedIp: env.MEDIASOUP_ANNOUNCED_IP,
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 600_000,
    });

    const peer = this.peers.get(userId);
    if (!peer) throw new Error(`Peer ${userId} not found`);

    if (direction === 'send') {
      peer.sendTransport?.close();
      peer.sendTransport = transport;
    } else {
      peer.recvTransport?.close();
      peer.recvTransport = transport;
    }

    return transport;
  }

  getTransport(transportId: string): WebRtcTransport | undefined {
    for (const peer of this.peers.values()) {
      if (peer.sendTransport?.id === transportId) return peer.sendTransport;
      if (peer.recvTransport?.id === transportId) return peer.recvTransport;
    }
    return undefined;
  }

  // ── Producer ────────────────────────────────────────────────────────────────

  setProducer(userId: string, producer: Producer) {
    const peer = this.peers.get(userId);
    if (!peer) throw new Error(`Peer ${userId} not found`);
    peer.producer?.close();
    peer.producer = producer;

    // Notify other peers
    this.broadcast(
      JSON.stringify({
        type: 'participantJoined',
        participant: { userId, nickname: peer.nickname, producerId: producer.id } satisfies ParticipantInfo,
      }),
      userId,
    );
  }

  removeProducer(userId: string) {
    const peer = this.peers.get(userId);
    if (!peer || !peer.producer) return;
    const producerId = peer.producer.id;
    peer.producer.close();
    peer.producer = null;

    this.broadcast(
      JSON.stringify({ type: 'producerClosed', producerId, userId }),
      userId,
    );
  }

  // ── Consumer ────────────────────────────────────────────────────────────────

  async createConsumer(
    consumingUserId: string,
    producerId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rtpCapabilities: any,
  ): Promise<Consumer> {
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume: incompatible rtpCapabilities');
    }

    const peer = this.peers.get(consumingUserId);
    if (!peer) throw new Error(`Peer ${consumingUserId} not found`);
    if (!peer.recvTransport) throw new Error('No recv transport');

    const consumer = await peer.recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true, // Client must call resumeConsumer to start
    });

    peer.consumers.set(consumer.id, consumer);

    consumer.on('producerclose', () => {
      peer.consumers.delete(consumer.id);
      peer.send(
        JSON.stringify({ type: 'producerClosed', producerId, userId: consumingUserId }),
      );
    });

    return consumer;
  }

  resumeConsumer(consumingUserId: string, consumerId: string) {
    const peer = this.peers.get(consumingUserId);
    if (!peer) return;
    const consumer = peer.consumers.get(consumerId);
    consumer?.resume();
  }

  // ── Participants ────────────────────────────────────────────────────────────

  getParticipants(): ParticipantInfo[] {
    return [...this.peers.values()].map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      producerId: p.producer?.id ?? null,
    }));
  }

  // ── Broadcast ───────────────────────────────────────────────────────────────

  broadcast(data: string, exceptUserId?: string) {
    for (const peer of this.peers.values()) {
      if (peer.userId === exceptUserId) continue;
      try {
        peer.send(data);
      } catch {
        // ignore disconnected peers
      }
    }
  }
}

// ─── VoiceRoomManager ─────────────────────────────────────────────────────────

export class VoiceRoomManager {
  private worker: Worker | null = null;
  private rooms = new Map<string, VoiceRoom>();
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      this.worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: env.MEDIASOUP_RTC_MIN_PORT,
        rtcMaxPort: env.MEDIASOUP_RTC_MAX_PORT,
      });
      this.worker.on('died', (err: Error) => {
        console.error('[VoiceRoomManager] mediasoup worker died:', err);
        process.exit(1);
      });
    })();
    return this.initPromise;
  }

  private async getOrCreateRoom(spaceId: string): Promise<VoiceRoom> {
    if (this.rooms.has(spaceId)) return this.rooms.get(spaceId)!;
    if (!this.worker) throw new Error('Worker not initialized');

    const router = await this.worker.createRouter({ mediaCodecs: AUDIO_CODECS });
    const room = new VoiceRoom(spaceId, router);
    this.rooms.set(spaceId, room);
    return room;
  }

  async joinRoom(
    spaceId: string,
    userId: string,
    nickname: string,
    send: (data: string) => void,
  ): Promise<VoiceRoom> {
    const room = await this.getOrCreateRoom(spaceId);
    room.addPeer(userId, nickname, send);
    return room;
  }

  async leaveRoom(spaceId: string, userId: string): Promise<void> {
    const room = this.rooms.get(spaceId);
    if (!room) return;
    await room.removePeer(userId);
    if (room.isEmpty()) {
      room.router.close();
      this.rooms.delete(spaceId);
    }
  }

  getRoom(spaceId: string): VoiceRoom | undefined {
    return this.rooms.get(spaceId);
  }
}

export const voiceRoomManager = new VoiceRoomManager();
