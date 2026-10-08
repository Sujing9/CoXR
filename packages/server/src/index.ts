import * as Y from 'yjs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { Hocuspocus } from '@hocuspocus/server';
import { Redis as HocuspocusRedis } from '@hocuspocus/extension-redis';
import { seedStarterDoc } from '@coxr/shared/yjs';
import { createVerifier } from 'fast-jwt';
import { env } from './env.js';
import { redis, docStateKey, DOC_STATE_TTL } from './lib/redis.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import spacesRoutes from './routes/spaces.js';
import webauthnRoutes from './routes/webauthn.js';
import importRoutes from './routes/import.js';
import aiRoutes from './routes/ai.js';
import { db } from './db/index.js';
import { spaceMembers, users } from './db/schema/index.js';
import { eq, and, inArray } from 'drizzle-orm';
import { voiceRoomManager } from './voice/VoiceRoomManager.js';
import type { ClientRequest } from './voice/types.js';

const { HOST, PORT } = env;

// 复用与 @fastify/jwt 相同的 secret 做独立校验（供 Hocuspocus hook 使用）
const jwtVerify = createVerifier({ key: env.JWT_SECRET });

/** 验证 JWT token 并检查是否为对应空间的有效成员 */
async function verifySpaceAccess(token: string, documentName: string): Promise<string> {
  if (!documentName.startsWith('space:')) {
    throw new Error('Invalid document name');
  }
  const spaceId = documentName.slice(6);

  let userId: string;
  try {
    const payload = jwtVerify(token) as { sub?: string };
    if (!payload.sub) throw new Error('Missing sub');
    userId = payload.sub;
  } catch {
    throw new Error('Invalid token');
  }

  const [member] = await db
    .select({ id: spaceMembers.id })
    .from(spaceMembers)
    .where(
      and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        inArray(spaceMembers.memberStatus, [1, 2]), // APPROVED_PENDING_JOIN 或 ACTIVE
      ),
    )
    .limit(1);

  if (!member) {
    throw new Error('Not a member of this space');
  }

  return userId;
}

const redisUrl = new URL(env.REDIS_URL);

const hocuspocus = new Hocuspocus({
  extensions: [
    new HocuspocusRedis({
      host: redisUrl.hostname,
      port: Number(redisUrl.port) || 6379,
    }),
  ],
  async onAuthenticate({ token, documentName }) {
    // 抛出错误则拒绝连接，返回对象存入 conn.context（Hocuspocus 会将返回值 spread 进 context）
    const userId = await verifySpaceAccess(token, documentName);

    // onConnect 在 onAuthenticate 之前触发，context 尚无 userId，
    // 因此在认证成功后立即处理 APPROVED_PENDING_JOIN → ACTIVE 的升级逻辑
    if (documentName.startsWith('space:')) {
      const spaceId = documentName.slice(6);
      const [membership] = await db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(
          and(
            eq(spaceMembers.spaceId, spaceId),
            eq(spaceMembers.userId, userId),
            eq(spaceMembers.memberStatus, 1), // APPROVED_PENDING_JOIN
          ),
        )
        .limit(1);

      if (membership) {
        const now = new Date();
        await db
          .update(spaceMembers)
          .set({ memberStatus: 2, lastJoinedAt: now, updatedAt: now })
          .where(eq(spaceMembers.id, membership.id));

        // 延迟确保连接已加入文档，再向其他成员广播刷新成员列表
        setTimeout(() => {
          const doc = hocuspocus.documents.get(`space:${spaceId}`);
          if (!doc) return;
          doc.broadcastStateless(
            JSON.stringify({ type: 'refresh_members' }),
            (conn) => (conn.context as { userId: string }).userId !== userId,
          );
        }, 500);
      }
    }

    return { userId };
  },
  async onDisconnect({ documentName, context, document, clientsCount }) {
    // Yjs 断开 = 用户真正离开空间，将 ACTIVE 降回 APPROVED_PENDING_JOIN（离线成员，可直接重连）
    if (!documentName.startsWith('space:')) return;
    const spaceId = documentName.slice(6);
    const { userId } = context as { userId?: string };
    if (!userId) return;

    // 若用户仍有其他连接在线（多 tab），则不变更状态
    const doc = hocuspocus.documents.get(`space:${spaceId}`);
    const stillConnected = doc
      ? [...doc.getConnections()].some(
          (conn) => (conn.context as { userId: string }).userId === userId,
        )
      : false;
    if (stillConnected) return;

    // 最后一个连接断开时，立即将当前文档状态快照存入 Redis
    // 防止 onStoreDocument 的 debounce 尚未触发就被文档卸载导致数据丢失
    if (clientsCount === 0 && document) {
      try {
        const state = Y.encodeStateAsUpdate(document);
        await redis.setex(docStateKey(spaceId), DOC_STATE_TTL, Buffer.from(state));
      } catch (err) {
        console.error(`[CoXR] Failed to persist document state on last disconnect for space ${spaceId}:`, err);
      }
    }

    const now = new Date();
    const updated = await db
      .update(spaceMembers)
      .set({ memberStatus: 1, lastLeftAt: now, updatedAt: now }) // 1 = APPROVED_PENDING_JOIN
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, 2), // 只更新 ACTIVE 的记录
        ),
      )
      .returning({ id: spaceMembers.id });

    if (updated.length === 0) return; // 非 ACTIVE（已被踢/已主动退出），跳过广播

    // 通知其他在线成员刷新列表
    setTimeout(() => {
      const doc2 = hocuspocus.documents.get(`space:${spaceId}`);
      if (!doc2) return;
      doc2.broadcastStateless(
        JSON.stringify({ type: 'refresh_members' }),
        (conn) => (conn.context as { userId: string }).userId !== userId,
      );
    }, 100);
  },
  async onStoreDocument({ documentName, document }) {
    // onChange 防抖后自动触发，将最新文档状态持久化到 Redis
    if (!documentName.startsWith('space:')) return;
    const spaceId = documentName.slice(6);
    try {
      const state = Y.encodeStateAsUpdate(document);
      await redis.setex(docStateKey(spaceId), DOC_STATE_TTL, Buffer.from(state));
    } catch (err) {
      console.error(`[CoXR] Failed to store document state for space ${spaceId}:`, err);
    }
  },
  async onLoadDocument({ documentName, document }) {
    if (!documentName.startsWith('space:')) return document;
    const spaceId = documentName.slice(6);

    // 优先从 Redis 恢复上一次持久化的文档状态
    try {
      const stored = await redis.getBuffer(docStateKey(spaceId));
      if (stored) {
        Y.applyUpdate(document, stored);
        return document;
      }
    } catch (err) {
      console.error(`[CoXR] Failed to load document state for space ${spaceId} from Redis:`, err);
    }

    // Redis 无记录（全新空间），填入初始内容
    seedStarterDoc(document);
    return document;
  },
});

// 初始化 mediasoup Worker（顶层 await，确保 Worker 在路由注册前就绪）
await voiceRoomManager.init();

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });
await app.register(websocket);
await app.register(authPlugin);

app.get('/health', async () => ({ status: 'ok' }));

/**
 * WebSocket 协同端点。
 * Hocuspocus v4 要求标准 Fetch API Request 对象，
 * documentName 由客户端通过 Hocuspocus 协议报文传入（provider.name 参数），
 * 认证 token 通过 provider.token 参数经协议报文传入。
 */
app.get('/ws', { websocket: true }, (socket, req) => {
  const proto = (req.headers['x-forwarded-proto'] as string) ?? 'http';
  const wsProto = proto === 'https' ? 'wss' : 'ws';
  const url = `${wsProto}://${req.headers.host ?? `${HOST}:${PORT}`}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value != null) {
      headers.set(key, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  const webRequest = new Request(url, { headers });
  const clientConn = hocuspocus.handleConnection(socket as unknown as WebSocket, webRequest);

  // Hocuspocus v4 采用手动集成模式：ClientConnection 不自行监听 WebSocket 事件，
  // 需要由宿主框架（Fastify）将消息和关闭事件手动转发给它。
  socket.on('message', (data: Buffer) => {
    clientConn.handleMessage(data as unknown as Uint8Array);
  });
  socket.on('close', () => {
    clientConn.handleClose();
  });
  socket.on('error', (err: Error) => {
    app.log.error({ err }, 'WebSocket error');
    clientConn.handleClose();
  });
});

await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(webauthnRoutes, { prefix: '/api/auth/webauthn' });
await app.register(userRoutes, { prefix: '/api/user' });
await app.register(spacesRoutes, { prefix: '/api/spaces', hocuspocus });
await app.register(importRoutes, { prefix: '/api/import' });
await app.register(aiRoutes, { prefix: '/api/ai' });

/**
 * Voice WebSocket 端点。
 * 连接时 query 携带 token + spaceId 完成认证。
 * 后续消息均为 JSON 信令，RPC 模式（client 带 requestId，server 回包带相同 requestId）。
 */
app.get('/voice', { websocket: true }, (socket, req) => {
  const query = req.query as Record<string, string>;
  const token = query['token'] ?? '';
  const spaceId = query['spaceId'] ?? '';

  if (!spaceId) {
    socket.close(4000, 'Missing spaceId');
    return;
  }

  // 在任何 await 之前立即注册消息/关闭监听器，防止初始化期间到达的消息被丢弃。
  // 初始化完成前收到的消息放入队列，完成后统一处理。
  const messageQueue: Buffer[] = [];
  let handleMessage: ((raw: Buffer) => Promise<void>) | null = null;
  let connectedUserId: string | null = null;

  socket.on('message', async (raw: Buffer) => {
    if (handleMessage) {
      await handleMessage(raw);
    } else {
      messageQueue.push(raw);
    }
  });

  socket.on('close', async () => {
    if (connectedUserId) {
      await voiceRoomManager.leaveRoom(spaceId, connectedUserId);
    }
  });

  socket.on('error', async () => {
    if (connectedUserId) {
      await voiceRoomManager.leaveRoom(spaceId, connectedUserId);
    }
  });

  (async () => {
    // 验证 token + 空间成员资格
    let userId: string;
    let nickname: string;
    try {
      const payload = jwtVerify(token) as { sub?: string };
      if (!payload.sub) throw new Error('Missing sub');
      userId = payload.sub;

      const [member] = await db
        .select({ id: spaceMembers.id })
        .from(spaceMembers)
        .where(
          and(
            eq(spaceMembers.spaceId, spaceId),
            eq(spaceMembers.userId, userId),
            inArray(spaceMembers.memberStatus, [1, 2]),
          ),
        )
        .limit(1);
      if (!member) throw new Error('Not a member');

      // 获取昵称
      const [userRow] = await db
        .select({ nickname: users.nickname })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      nickname = userRow?.nickname ?? userId;
    } catch (err) {
      socket.close(4001, 'Unauthorized');
      return;
    }

    const send = (data: string) => {
      try {
        socket.send(data);
      } catch {
        // ignore
      }
    };

    const room = await voiceRoomManager.joinRoom(spaceId, userId, nickname, send);
    // 设置后 close/error 处理器才能正确调用 leaveRoom
    connectedUserId = userId;

    // 通知房间内已有成员：新参与者加入（尚无麦克风）
    room.broadcast(
      JSON.stringify({
        type: 'participantJoined',
        participant: { userId, nickname, producerId: null },
      }),
      userId,
    );

    handleMessage = async (raw: Buffer) => {
      let msg: ClientRequest;
      try {
        msg = JSON.parse(raw.toString()) as ClientRequest;
      } catch {
        return;
      }

      const { requestId } = msg as { requestId?: string };
      const reply = (payload: object) =>
        send(JSON.stringify({ ...payload, requestId }));
      const replyError = (message: string) =>
        send(JSON.stringify({ type: 'error', requestId, message }));

      try {
        switch (msg.type) {
          case 'getRouterRtpCapabilities': {
            reply({ type: 'routerRtpCapabilities', rtpCapabilities: room.router.rtpCapabilities });
            break;
          }

          case 'createTransport': {
            const transport = await room.createWebRtcTransport(userId, msg.direction);
            reply({
              type: 'transportCreated',
              id: transport.id,
              iceParameters: transport.iceParameters,
              iceCandidates: transport.iceCandidates,
              dtlsParameters: transport.dtlsParameters,
            });
            break;
          }

          case 'connectTransport': {
            const transport = room.getTransport(msg.transportId);
            if (!transport) { replyError('Transport not found'); break; }
            await transport.connect({ dtlsParameters: msg.dtlsParameters });
            reply({ type: 'ok' });
            break;
          }

          case 'produce': {
            const peer = room.getPeer(userId);
            if (!peer?.sendTransport) { replyError('No send transport'); break; }
            const producer = await peer.sendTransport.produce({
              kind: msg.kind,
              rtpParameters: msg.rtpParameters,
            });
            room.setProducer(userId, producer);
            reply({ type: 'produced', id: producer.id });
            break;
          }

          case 'closeProducer': {
            room.removeProducer(userId);
            reply({ type: 'ok' });
            break;
          }

          case 'getParticipants': {
            reply({ type: 'participants', participants: room.getParticipants() });
            break;
          }

          case 'consume': {
            const consumer = await room.createConsumer(userId, msg.producerId, msg.rtpCapabilities);
            reply({
              type: 'consumed',
              id: consumer.id,
              producerId: consumer.producerId,
              kind: consumer.kind,
              rtpParameters: consumer.rtpParameters,
            });
            break;
          }

          case 'resumeConsumer': {
            room.resumeConsumer(userId, msg.consumerId);
            reply({ type: 'ok' });
            break;
          }

          default:
            replyError('Unknown message type');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        replyError(message);
      }
    };

    // 处理初始化期间积压的消息
    for (const raw of messageQueue) {
      await handleMessage(raw);
    }
    messageQueue.length = 0;
  })().catch((err) => {
    app.log.error(err, 'Voice WebSocket setup error');
    socket.close(4002, 'Internal error');
  });
});

try {
  await app.listen({ host: HOST, port: PORT });
  app.log.info(`CoXR server listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
