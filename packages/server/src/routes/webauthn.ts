import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, count } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  CredentialDeviceType,
} from '@simplewebauthn/server';
import { db } from '../db/index.js';
import { users, userWebauthnCredentials, userPasswordAuth } from '../db/schema/index.js';
import { env } from '../env.js';
import { redis, CHALLENGE_TTL } from '../lib/redis.js';

const REG_CHALLENGE_PREFIX = 'webauthn:reg:';
const LOGIN_SESSION_PREFIX = 'webauthn:login:session:';

/** 将 Base64URL 字符串转换为 Buffer */
function b64urlToBuffer(b64url: string): Buffer {
  return Buffer.from(b64url.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** 将 Buffer 转换为 Base64URL 字符串 */
function bufferToB64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64url');
}

export default async function webauthnRoutes(app: FastifyInstance) {
  const rpID = env.WEBAUTHN_RP_ID;
  const rpName = env.WEBAUTHN_RP_NAME;
  const expectedOrigin = env.WEBAUTHN_RP_ORIGIN;

  // ─── 注册：开始 ──────────────────────────────────────────────────────────────
  // POST /api/auth/webauthn/register/begin
  // 需要 JWT 登录态，返回注册 options
  app.post('/register/begin', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { sub: userId } = request.user;

    const [user] = await db
      .select({ id: users.id, username: users.username, nickname: users.nickname })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    // 已有的凭证 ID 列表，避免重复注册同一设备
    const existingCredentials = await db
      .select({ credentialId: userWebauthnCredentials.credentialId })
      .from(userWebauthnCredentials)
      .where(eq(userWebauthnCredentials.userId, userId));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.username,
      userDisplayName: user.nickname,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({
        id: bufferToB64url(c.credentialId as unknown as Buffer),
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await redis.set(
      `${REG_CHALLENGE_PREFIX}${userId}`,
      options.challenge,
      'EX',
      CHALLENGE_TTL,
    );

    return reply.send(options);
  });

  // ─── 注册：完成 ──────────────────────────────────────────────────────────────
  // POST /api/auth/webauthn/register/complete
  // 需要 JWT 登录态，body: { response, deviceName }
  app.post('/register/complete', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const bodySchema = z.object({
      response: z.record(z.unknown()),
      deviceName: z.string().min(1).max(128).default('我的通行证'),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { sub: userId } = request.user;
    const { response, deviceName } = parsed.data;

    const expectedChallenge = await redis.get(`${REG_CHALLENGE_PREFIX}${userId}`);
    if (!expectedChallenge) {
      return reply.status(400).send({ error: '注册会话已过期，请重新开始' });
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: response as unknown as Parameters<typeof verifyRegistrationResponse>[0]['response'],
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '验证失败';
      return reply.status(400).send({ error: message });
    }

    if (!verification.verified || !verification.registrationInfo) {
      return reply.status(400).send({ error: '注册验证未通过' });
    }

    const { credential, credentialDeviceType, aaguid } = verification.registrationInfo;

    const credentialIdBuf = b64urlToBuffer(credential.id);
    const publicKeyBuf = Buffer.from(credential.publicKey);

    // aaguid 在新版 @simplewebauthn/server 中已是标准 UUID 字符串，直接使用
    // 若为原始字节（Uint8Array），则手动格式化为 UUID
    const aaguidUuid = typeof aaguid === 'string'
      ? aaguid
      : (() => {
          const hex = Buffer.from(aaguid as Uint8Array).toString('hex');
          return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        })();

    const transports = (
      (credential.transports ?? []) as AuthenticatorTransportFuture[]
    ).filter(Boolean);

    const [inserted] = await db
      .insert(userWebauthnCredentials)
      .values({
        userId,
        credentialId: credentialIdBuf as unknown as Buffer,
        publicKey: publicKeyBuf as unknown as Buffer,
        signCount: credential.counter,
        transports: transports.length > 0 ? transports : null,
        aaguid: aaguidUuid,
        deviceName,
        lastUsedAt: new Date(),
      })
      .returning({
        id: userWebauthnCredentials.id,
        deviceName: userWebauthnCredentials.deviceName,
        createdAt: userWebauthnCredentials.createdAt,
      });

    await redis.del(`${REG_CHALLENGE_PREFIX}${userId}`);

    return reply.status(201).send({ credential: inserted });
  });

  // ─── 登录：开始 ──────────────────────────────────────────────────────────────
  // POST /api/auth/webauthn/login/begin
  // 无需 JWT，无需 body
  // 使用 Discoverable Credential 流程：allowCredentials 为空，浏览器弹出通行证选择器
  app.post('/login/begin', async (_request, reply) => {
    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      allowCredentials: [], // 空 = 让浏览器自动发现设备上的通行证
    });

    // 用随机 sessionId 绑定 challenge，避免依赖 username
    const sessionId = randomUUID();
    await redis.set(
      `${LOGIN_SESSION_PREFIX}${sessionId}`,
      options.challenge,
      'EX',
      CHALLENGE_TTL,
    );

    return reply.send({ ...options, sessionId });
  });

  // ─── 登录：完成 ──────────────────────────────────────────────────────────────
  // POST /api/auth/webauthn/login/complete
  // 无需 JWT，body: { sessionId, response }
  app.post('/login/complete', async (request, reply) => {
    const bodySchema = z.object({
      sessionId: z.string().uuid(),
      response: z.record(z.unknown()),
    });
    const parsed = bodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { sessionId, response } = parsed.data;

    const expectedChallenge = await redis.get(`${LOGIN_SESSION_PREFIX}${sessionId}`);
    if (!expectedChallenge) {
      return reply.status(400).send({ error: '登录会话已过期，请重新开始' });
    }

    // 从 response.response.userHandle 解析用户 ID（注册时写入 userID = UTF-8(userId)）
    const responseObj = response as Record<string, unknown>;
    const innerResponse = responseObj.response as Record<string, unknown> | undefined;
    const userHandleB64 =
      typeof innerResponse?.userHandle === 'string' ? innerResponse.userHandle : null;

    if (!userHandleB64) {
      return reply.status(401).send({ error: '通行证未包含用户信息，请确认设备支持 Discoverable Credential' });
    }

    // userHandle = UTF-8 bytes of userId UUID
    const userId = Buffer.from(userHandleB64, 'base64url').toString('utf8');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.status(401).send({ error: '认证失败' });
    }

    // 通过 response 中的 credentialId 找到对应凭证
    const rawId =
      typeof responseObj.rawId === 'string'
        ? responseObj.rawId
        : typeof responseObj.id === 'string'
          ? responseObj.id
          : null;

    if (!rawId) {
      return reply.status(400).send({ error: '响应缺少 credentialId' });
    }

    const credentialIdBuf = b64urlToBuffer(rawId);

    const [storedCredential] = await db
      .select()
      .from(userWebauthnCredentials)
      .where(
        and(
          eq(userWebauthnCredentials.userId, user.id),
          eq(userWebauthnCredentials.credentialId, credentialIdBuf as unknown as Buffer),
        ),
      )
      .limit(1);

    if (!storedCredential) {
      return reply.status(401).send({ error: '凭证不存在' });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: response as unknown as Parameters<typeof verifyAuthenticationResponse>[0]['response'],
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        credential: {
          id: bufferToB64url(storedCredential.credentialId as unknown as Buffer),
          publicKey: new Uint8Array(storedCredential.publicKey as unknown as Buffer),
          counter: storedCredential.signCount,
          transports: (storedCredential.transports ?? []) as AuthenticatorTransportFuture[],
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '认证失败';
      return reply.status(401).send({ error: message });
    }

    if (!verification.verified) {
      return reply.status(401).send({ error: '认证未通过' });
    }

    // 更新 signCount 与最后使用时间
    await db
      .update(userWebauthnCredentials)
      .set({
        signCount: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(userWebauthnCredentials.id, storedCredential.id));

    await redis.del(`${LOGIN_SESSION_PREFIX}${sessionId}`);

    const token = app.jwt.sign(
      { sub: user.id, permissions: user.permissions },
      { expiresIn: env.JWT_EXPIRES_IN },
    );

    return reply.send({
      token,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        permissions: user.permissions,
      },
    });
  });

  // ─── 通行证列表 ──────────────────────────────────────────────────────────────
  // GET /api/auth/webauthn/credentials
  // 需要 JWT
  app.get('/credentials', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { sub: userId } = request.user;

    const credentials = await db
      .select({
        id: userWebauthnCredentials.id,
        deviceName: userWebauthnCredentials.deviceName,
        aaguid: userWebauthnCredentials.aaguid,
        transports: userWebauthnCredentials.transports,
        createdAt: userWebauthnCredentials.createdAt,
        lastUsedAt: userWebauthnCredentials.lastUsedAt,
      })
      .from(userWebauthnCredentials)
      .where(eq(userWebauthnCredentials.userId, userId));

    return reply.send({ credentials });
  });

  // ─── 删除通行证 ──────────────────────────────────────────────────────────────
  // DELETE /api/auth/webauthn/credentials/:id
  // 需要 JWT
  app.delete('/credentials/:id', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { sub: userId } = request.user;

    // 确认凭证属于当前用户
    const [credential] = await db
      .select({ id: userWebauthnCredentials.id })
      .from(userWebauthnCredentials)
      .where(
        and(
          eq(userWebauthnCredentials.id, id),
          eq(userWebauthnCredentials.userId, userId),
        ),
      )
      .limit(1);

    if (!credential) {
      return reply.status(404).send({ error: '通行证不存在' });
    }

    // 若用户无密码且只剩最后一个通行证，拒绝删除
    const [passwordAuth] = await db
      .select({ userId: userPasswordAuth.userId })
      .from(userPasswordAuth)
      .where(eq(userPasswordAuth.userId, userId))
      .limit(1);

    if (!passwordAuth) {
      const [countResult] = await db
        .select({ count: count() })
        .from(userWebauthnCredentials)
        .where(eq(userWebauthnCredentials.userId, userId));

      if (Number(countResult?.count ?? 0) <= 1) {
        return reply.status(409).send({
          error: '无法删除最后一个通行证（该账号无密码登录方式）',
        });
      }
    }

    await db
      .delete(userWebauthnCredentials)
      .where(
        and(
          eq(userWebauthnCredentials.id, id),
          eq(userWebauthnCredentials.userId, userId),
        ),
      );

    return reply.status(204).send();
  });
}
