import type { FastifyInstance } from 'fastify';
import type { Hocuspocus } from '@hocuspocus/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  collaborationSpaces,
  spaceMembers,
  spaceEventLogs,
  spaceSnapshots,
  users,
} from '../db/schema/index.js';
import { redis, docStateKey } from '../lib/redis.js';

// ─── SpaceStatus / MemberRole / MemberStatus 常量 ────────────────────────────

const SpaceStatus = { OPEN: 0, APPLY_REQUIRED: 1, CLOSED: 2 } as const;
const MemberRole = { MEMBER: 0, ADMIN: 1, OWNER: 2 } as const;
const MemberStatus = {
  PENDING: 0,
  APPROVED_PENDING_JOIN: 1,
  ACTIVE: 2,
  REJECTED: 3,
  LEFT: 4,
  REMOVED: 5,
} as const;

// ─── helpers ──────────────────────────────────────────────────────────────────

/** 生成 4 位纯数字访问码 */
function generateAccessCode(): string {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

/** 写入一条事件日志 */
async function logEvent(params: {
  spaceId: string;
  userId: string;
  targetUserId?: string;
  eventType: string;
  eventData?: unknown;
}) {
  await db.insert(spaceEventLogs).values({
    spaceId: params.spaceId,
    userId: params.userId,
    targetUserId: params.targetUserId ?? null,
    eventType: params.eventType,
    eventData: params.eventData ?? null,
  });
}

// ─── Hocuspocus broadcast helper ────────────────────────────────────────────

/**
 * 向某个空间内的所有（或满足 filter 条件的）在线连接发送 stateless 消息。
 * 消息 payload 为 JSON 序列化的对象。
 */
function broadcastToSpace(
  hocuspocus: Hocuspocus,
  spaceId: string,
  payload: object,
  filter?: (userId: string) => boolean,
): void {
  const docName = `space:${spaceId}`;
  const doc = hocuspocus.documents.get(docName);
  if (!doc) return;
  const json = JSON.stringify(payload);
  doc.broadcastStateless(json, filter ? (conn) => filter((conn.context as { userId: string }).userId) : undefined);
}

/**
 * 向特定用户发送 stateless 消息，并可选地关闭其连接。
 */
function sendToUser(
  hocuspocus: Hocuspocus,
  spaceId: string,
  targetUserId: string,
  payload: object,
  closeAfter = false,
): void {
  const docName = `space:${spaceId}`;
  const doc = hocuspocus.documents.get(docName);
  if (!doc) return;
  const json = JSON.stringify(payload);
  for (const conn of doc.getConnections()) {
    if ((conn.context as { userId: string }).userId === targetUserId) {
      conn.sendStateless(json);
      if (closeAfter) {
        // 短暂延迟确保消息先行到达客户端
        setTimeout(() => conn.close(), 300);
      }
    }
  }
}

// ─── 路由 ─────────────────────────────────────────────────────────────────────

const createSpaceBody = z.object({
  name: z.string().min(1).max(64).optional(),
});

const joinSpaceBody = z.object({
  accessCode: z.string().length(4),
});

const createSnapshotBody = z.object({
  name: z.string().min(1).max(128),
  yjsDocument: z.string(), // base64 编码的 bytea
});

export default async function spacesRoutes(app: FastifyInstance, options: { hocuspocus?: Hocuspocus } = {}) {
  const hp = options.hocuspocus;
  // ── POST /api/spaces — 创建空间 ──────────────────────────────────────────
  app.post('/', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const parsed = createSpaceBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { sub: userId } = request.user;

    // 生成唯一访问码（最多重试 5 次）
    let accessCode = '';
    for (let i = 0; i < 5; i++) {
      const candidate = generateAccessCode();
      const existing = await db
        .select({ id: collaborationSpaces.id })
        .from(collaborationSpaces)
        .where(eq(collaborationSpaces.accessCode, candidate))
        .limit(1);
      if (existing.length === 0) {
        accessCode = candidate;
        break;
      }
    }
    if (!accessCode) {
      return reply.status(500).send({ error: '无法生成唯一访问码，请稍后重试' });
    }

    const [space] = await db
      .insert(collaborationSpaces)
      .values({
        accessCode,
        creatorUserId: userId,
        ownerUserId: userId,
        status: SpaceStatus.OPEN,
      })
      .returning();

    // 将创建者写入 space_members（owner 角色，直接 active）
    await db.insert(spaceMembers).values({
      spaceId: space!.id,
      userId,
      memberRole: MemberRole.OWNER,
      memberStatus: MemberStatus.ACTIVE,
      lastJoinedAt: new Date(),
    });

    await logEvent({ spaceId: space!.id, userId, eventType: 'create_space' });

    return reply.status(201).send({
      space: {
        ...space,
        myRole: MemberRole.OWNER,
        memberStatus: MemberStatus.ACTIVE,
        lastJoinedAt: new Date().toISOString(),
      },
    });
  });

  // ── GET /api/spaces/mine — 我的空间列表（含申请中的空间）──────────────────
  app.get('/mine', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { sub: userId } = request.user;

    // 查出我是 active 或 pending 成员的所有 spaceId
    const memberships = await db
      .select({
        spaceId: spaceMembers.spaceId,
        memberRole: spaceMembers.memberRole,
        memberStatus: spaceMembers.memberStatus,
        lastJoinedAt: spaceMembers.lastJoinedAt,
      })
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.userId, userId),
          inArray(spaceMembers.memberStatus, [MemberStatus.ACTIVE, MemberStatus.APPROVED_PENDING_JOIN, MemberStatus.PENDING]),
        ),
      );

    if (memberships.length === 0) {
      return reply.send({ spaces: [] });
    }

    const spaceIds = memberships.map((m) => m.spaceId);
    const spaces = await db
      .select()
      .from(collaborationSpaces)
      .where(inArray(collaborationSpaces.id, spaceIds));

    // 将角色和状态附加到每个空间
    const membershipMap = new Map(memberships.map((m) => [m.spaceId, m]));
    const result = spaces.map((s) => {
      const m = membershipMap.get(s.id);
      return {
        ...s,
        myRole: m?.memberRole ?? 0,
        memberStatus: m?.memberStatus ?? MemberStatus.ACTIVE,
        // lastJoinedAt 用于区分「离线成员（可直接重连）」和「新批准待首次进入」
        lastJoinedAt: m?.lastJoinedAt ?? null,
      };
    });

    return reply.send({ spaces: result });
  });

  // ── GET /api/spaces/:spaceId — 空间详情 ─────────────────────────────────
  app.get('/:spaceId', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }

    const [space] = await db
      .select()
      .from(collaborationSpaces)
      .where(eq(collaborationSpaces.id, spaceId))
      .limit(1);

    if (!space) {
      return reply.status(404).send({ error: '空间不存在' });
    }

    return reply.send({ space: { ...space, myRole: membership.memberRole } });
  });

  // ── POST /api/spaces/join — 通过 accessCode 加入 ────────────────────────
  app.post('/join', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const parsed = joinSpaceBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { accessCode } = parsed.data;
    const { sub: userId } = request.user;

    const [space] = await db
      .select()
      .from(collaborationSpaces)
      .where(eq(collaborationSpaces.accessCode, accessCode))
      .limit(1);

    if (!space) {
      return reply.status(404).send({ error: '访问码无效' });
    }

    if (space.status === SpaceStatus.CLOSED) {
      return reply.status(403).send({ error: '该空间已禁止加入' });
    }

    // 检查是否已有成员记录
    const [existingMember] = await db
      .select()
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, space.id), eq(spaceMembers.userId, userId)))
      .limit(1);

    // ACTIVE 或 APPROVED_PENDING_JOIN 均视为已是成员（前者在线，后者离线可直接重连）
    if (existingMember && (
      existingMember.memberStatus === MemberStatus.ACTIVE ||
      existingMember.memberStatus === MemberStatus.APPROVED_PENDING_JOIN
    )) {
      return reply.send({ space, alreadyMember: true });
    }

    if (existingMember?.memberStatus === MemberStatus.REMOVED) {
      return reply.status(403).send({ error: '你已被移出该空间' });
    }

    // 根据空间状态决定直接预授权还是 pending
    // ACTIVE 真正由 Hocuspocus 连接时设置，REST 仅负责预授权（APPROVED_PENDING_JOIN）
    const isOpen = space.status === SpaceStatus.OPEN;
    const newStatus = isOpen ? MemberStatus.APPROVED_PENDING_JOIN : MemberStatus.PENDING;
    const now = new Date();

    if (existingMember) {
      await db
        .update(spaceMembers)
        .set({ memberStatus: newStatus, updatedAt: now })
        .where(eq(spaceMembers.id, existingMember.id));
    } else {
      await db.insert(spaceMembers).values({
        spaceId: space.id,
        userId,
        memberRole: MemberRole.MEMBER,
        memberStatus: newStatus,
      });
    }

    await logEvent({
      spaceId: space.id,
      userId,
      eventType: isOpen ? 'join' : 'apply_join',
    });

    if (hp) {
      if (isOpen) {
        // 新成员直接加入，通知所有在线成员刷新列表
        broadcastToSpace(hp, space.id, { type: 'refresh_members' });
      } else {
        // 有新申请时通知空间内的管理员
        broadcastToSpace(hp, space.id, { type: 'new_application' });
      }
    }

    return reply.status(isOpen ? 200 : 202).send({
      space,
      joined: isOpen,
      pending: !isOpen,
    });
  });

  // ── POST /api/spaces/:spaceId/snapshots — 创建快照 ──────────────────────
  app.post('/:spaceId/snapshots', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const parsed = createSnapshotBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    // 验证成员身份且为 admin / owner
    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }
    if (membership.memberRole !== MemberRole.OWNER) {
      return reply.status(403).send({ error: '只有所有者才能创建快照' });
    }

    const docBuffer = Buffer.from(parsed.data.yjsDocument, 'base64');

    const [snapshot] = await db
      .insert(spaceSnapshots)
      .values({
        spaceId,
        name: parsed.data.name,
        yjsDocument: docBuffer,
        createdByUserId: userId,
      })
      .returning({
        id: spaceSnapshots.id,
        spaceId: spaceSnapshots.spaceId,
        name: spaceSnapshots.name,
        createdByUserId: spaceSnapshots.createdByUserId,
        createdAt: spaceSnapshots.createdAt,
      });

    await logEvent({ spaceId, userId, eventType: 'create_snapshot', eventData: { snapshotId: snapshot!.id, name: parsed.data.name } });

    return reply.status(201).send({ snapshot });
  });

  // ── DELETE /api/spaces/:spaceId/snapshots/:snapshotId — 删除快照（仅 owner）─
  app.delete('/:spaceId/snapshots/:snapshotId', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, snapshotId } = request.params as { spaceId: string; snapshotId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }
    if (membership.memberRole !== MemberRole.OWNER) {
      return reply.status(403).send({ error: '只有所有者才能删除快照' });
    }

    const [deleted] = await db
      .delete(spaceSnapshots)
      .where(and(eq(spaceSnapshots.id, snapshotId), eq(spaceSnapshots.spaceId, spaceId)))
      .returning({ id: spaceSnapshots.id });

    if (!deleted) {
      return reply.status(404).send({ error: '快照不存在' });
    }

    await logEvent({ spaceId, userId, eventType: 'delete_snapshot', eventData: { snapshotId } });

    return reply.send({ message: '快照已删除' });
  });

  // ── POST /api/spaces/:spaceId/snapshots/:snapshotId/restore — 恢复快照（仅 owner）
  app.post('/:spaceId/snapshots/:snapshotId/restore', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, snapshotId } = request.params as { spaceId: string; snapshotId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }
    if (membership.memberRole !== MemberRole.OWNER) {
      return reply.status(403).send({ error: '只有所有者才能恢复快照' });
    }

    const [snapshot] = await db
      .select({ yjsDocument: spaceSnapshots.yjsDocument, name: spaceSnapshots.name })
      .from(spaceSnapshots)
      .where(and(eq(spaceSnapshots.id, snapshotId), eq(spaceSnapshots.spaceId, spaceId)))
      .limit(1);

    if (!snapshot) {
      return reply.status(404).send({ error: '快照不存在' });
    }

    const yjsDocument = (snapshot.yjsDocument as Buffer).toString('base64');

    await logEvent({ spaceId, userId, eventType: 'restore_snapshot', eventData: { snapshotId, name: snapshot.name } });

    return reply.send({ yjsDocument });
  });

  // ── DELETE /api/spaces/:spaceId — 退出或删除空间 ────────────────────────
  app.delete('/:spaceId', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    // 查询当前用户与该空间的成员关系
    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
      .limit(1);

    // 无任何关联记录
    if (!membership) {
      return reply.status(200).send({ message: '无需退出，你与该空间没有关联' });
    }

    // @TODO: 如果用户正处于该房间，则需要进行强制断开连接的操作

    
    const isOwner = membership.memberRole === MemberRole.OWNER;

    if (!isOwner) {
      // 非所有者：将状态改为 LEFT 并记录离开时间，保留历史记录
      const now = new Date();
      await db
        .update(spaceMembers)
        .set({ memberStatus: MemberStatus.LEFT, lastLeftAt: now, updatedAt: now })
        .where(eq(spaceMembers.id, membership.id));
      await logEvent({ spaceId, userId, eventType: 'leave' });
      // 通知其他在线成员刷新列表
      if (hp) {
        broadcastToSpace(hp, spaceId, { type: 'refresh_members' }, (uid) => uid !== userId);
      }
      return reply.status(200).send({ message: '已退出空间' });
    }

    // 所有者：删除空间及所有关联数据
    await db.delete(spaceSnapshots).where(eq(spaceSnapshots.spaceId, spaceId));
    await db.delete(spaceMembers).where(eq(spaceMembers.spaceId, spaceId));
    await db.delete(collaborationSpaces).where(eq(collaborationSpaces.id, spaceId));
    // 同步清除 Redis 中存储的文档状态
    await redis.del(docStateKey(spaceId));

    return reply.status(200).send({ message: '空间已删除' });
  });

  // ── GET /api/spaces/:spaceId/snapshots — 快照列表 ────────────────────────
  app.get('/:spaceId/snapshots', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, userId),
          eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
        ),
      )
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }

    const snapshots = await db
      .select({
        id: spaceSnapshots.id,
        spaceId: spaceSnapshots.spaceId,
        name: spaceSnapshots.name,
        createdByUserId: spaceSnapshots.createdByUserId,
        createdAt: spaceSnapshots.createdAt,
      })
      .from(spaceSnapshots)
      .where(eq(spaceSnapshots.spaceId, spaceId))
      .orderBy(spaceSnapshots.createdAt);

    return reply.send({ snapshots });
  });

  // ── GET /api/spaces/:spaceId/members — 活跃成员列表（含用户信息）────────────
  app.get('/:spaceId/members', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }

    const members = await db
      .select({
        memberId: spaceMembers.id,
        userId: spaceMembers.userId,
        memberRole: spaceMembers.memberRole,
        memberStatus: spaceMembers.memberStatus,
        lastJoinedAt: spaceMembers.lastJoinedAt,
        lastLeftAt: spaceMembers.lastLeftAt,
        nickname: users.nickname,
        username: users.username,
      })
      .from(spaceMembers)
      .innerJoin(users, eq(spaceMembers.userId, users.id))
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ));

    return reply.send({ members, myRole: membership.memberRole });
  });

  // ── GET /api/spaces/:spaceId/applications — 申请列表（Admin+）────────────
  app.get('/:spaceId/applications', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const [membership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!membership) {
      return reply.status(403).send({ error: '无权访问该空间' });
    }
    if (membership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能查看申请列表' });
    }

    const applications = await db
      .select({
        memberId: spaceMembers.id,
        userId: spaceMembers.userId,
        memberRole: spaceMembers.memberRole,
        memberStatus: spaceMembers.memberStatus,
        createdAt: spaceMembers.createdAt,
        nickname: users.nickname,
        username: users.username,
      })
      .from(spaceMembers)
      .innerJoin(users, eq(spaceMembers.userId, users.id))
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.memberStatus, MemberStatus.PENDING),
      ));

    return reply.send({ applications });
  });

  // ── POST /api/spaces/:spaceId/members/:targetUserId/kick — 踢出成员 ───────
  app.post('/:spaceId/members/:targetUserId/kick', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, targetUserId } = request.params as { spaceId: string; targetUserId: string };
    const { sub: userId } = request.user;

    if (userId === targetUserId) {
      return reply.status(400).send({ error: '不能踢出自己' });
    }

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能踢出成员' });
    }

    const [targetMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, targetUserId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!targetMembership) {
      return reply.status(404).send({ error: '目标用户不在该空间中' });
    }

    // 只能踢出角色低于自己的成员
    if (targetMembership.memberRole >= myMembership.memberRole) {
      return reply.status(403).send({ error: '不能踢出同级或更高权限的成员' });
    }

    await db
      .update(spaceMembers)
      .set({ memberStatus: MemberStatus.REMOVED, updatedAt: new Date() })
      .where(eq(spaceMembers.id, targetMembership.id));

    await logEvent({ spaceId, userId, targetUserId, eventType: 'kick_member' });

    // 通知被踢出的用户并强制断开连接，同时刷新其余成员列表
    if (hp) {
      sendToUser(hp, spaceId, targetUserId, { type: 'kicked' }, true);
      broadcastToSpace(hp, spaceId, { type: 'refresh_members' }, (uid) => uid !== targetUserId);
    }

    return reply.send({ message: '成员已踢出' });
  });

  // ── POST /api/spaces/:spaceId/members/:targetUserId/unkick — 取消踢出 ─────
  app.post('/:spaceId/members/:targetUserId/unkick', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, targetUserId } = request.params as { spaceId: string; targetUserId: string };
    const { sub: userId } = request.user;

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能取消踢出' });
    }

    const [targetMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, targetUserId),
        eq(spaceMembers.memberStatus, MemberStatus.REMOVED),
      ))
      .limit(1);

    if (!targetMembership) {
      return reply.status(404).send({ error: '未找到被踢出的成员记录' });
    }

    // 直接删除记录，后续如需重新加入按空间规则处理
    await db
      .delete(spaceMembers)
      .where(eq(spaceMembers.id, targetMembership.id));

    await logEvent({ spaceId, userId, targetUserId, eventType: 'unkick_member' });

    return reply.send({ message: '已移出黑名单，该成员可重新加入空间' });
  });

  // ── GET /api/spaces/:spaceId/removed-members — 已踢出成员列表（Admin+）─────
  app.get('/:spaceId/removed-members', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能查看已踢出成员' });
    }

    const removed = await db
      .select({
        memberId: spaceMembers.id,
        userId: spaceMembers.userId,
        memberRole: spaceMembers.memberRole,
        memberStatus: spaceMembers.memberStatus,
        updatedAt: spaceMembers.updatedAt,
        nickname: users.nickname,
        username: users.username,
      })
      .from(spaceMembers)
      .innerJoin(users, eq(spaceMembers.userId, users.id))
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.memberStatus, MemberStatus.REMOVED),
      ));

    return reply.send({ removed });
  });

  // ── POST /api/spaces/:spaceId/applications/:targetUserId/approve — 通过申请
  app.post('/:spaceId/applications/:targetUserId/approve', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, targetUserId } = request.params as { spaceId: string; targetUserId: string };
    const { sub: userId } = request.user;

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能审批申请' });
    }

    const [application] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, targetUserId),
        eq(spaceMembers.memberStatus, MemberStatus.PENDING),
      ))
      .limit(1);

    if (!application) {
      return reply.status(404).send({ error: '申请记录不存在' });
    }

    const now = new Date();
    await db
      .update(spaceMembers)
      // 批准后进入「已批准待进入」状态，等用户首次连接 Hocuspocus 时再升级为 ACTIVE
      .set({ memberStatus: MemberStatus.APPROVED_PENDING_JOIN, updatedAt: now })
      .where(eq(spaceMembers.id, application.id));

    await logEvent({ spaceId, userId, targetUserId, eventType: 'approve_application' });

    // 通知管理员端刷新申请列表（申请已处理）
    if (hp) {
      broadcastToSpace(hp, spaceId, { type: 'refresh_applications' });
    }

    return reply.send({ message: '申请已通过' });
  });

  // ── POST /api/spaces/:spaceId/applications/:targetUserId/reject — 拒绝申请
  app.post('/:spaceId/applications/:targetUserId/reject', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId, targetUserId } = request.params as { spaceId: string; targetUserId: string };
    const { sub: userId } = request.user;

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能审批申请' });
    }

    const [application] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, targetUserId),
        eq(spaceMembers.memberStatus, MemberStatus.PENDING),
      ))
      .limit(1);

    if (!application) {
      return reply.status(404).send({ error: '申请记录不存在' });
    }

    await db
      .update(spaceMembers)
      .set({ memberStatus: MemberStatus.REJECTED, updatedAt: new Date() })
      .where(eq(spaceMembers.id, application.id));

    await logEvent({ spaceId, userId, targetUserId, eventType: 'reject_application' });

    // 刷新管理员的申请列表
    if (hp) {
      broadcastToSpace(hp, spaceId, { type: 'refresh_applications' });
    }

    return reply.send({ message: '申请已拒绝' });
  });

  // ── PATCH /api/spaces/:spaceId/status — 调整空间状态（Admin+）──────────────
  app.patch('/:spaceId/status', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { spaceId } = request.params as { spaceId: string };
    const { sub: userId } = request.user;

    const parsed = z.object({ status: z.number().int().min(0).max(2) }).safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const [myMembership] = await db
      .select()
      .from(spaceMembers)
      .where(and(
        eq(spaceMembers.spaceId, spaceId),
        eq(spaceMembers.userId, userId),
        eq(spaceMembers.memberStatus, MemberStatus.ACTIVE),
      ))
      .limit(1);

    if (!myMembership || myMembership.memberRole < MemberRole.ADMIN) {
      return reply.status(403).send({ error: '只有管理员及以上才能修改空间状态' });
    }

    await db
      .update(collaborationSpaces)
      .set({ status: parsed.data.status })
      .where(eq(collaborationSpaces.id, spaceId));

    await logEvent({ spaceId, userId, eventType: 'update_space_status', eventData: { status: parsed.data.status } });

    return reply.send({ status: parsed.data.status });
  });
}
