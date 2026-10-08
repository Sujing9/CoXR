import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userPasswordAuth } from '../db/schema/index.js';

const patchMeBody = z.object({
  nickname: z.string().min(1).max(64),
});

const changePasswordBody = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export default async function userRoutes(app: FastifyInstance) {
  // GET /api/user/me
  app.get('/me', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const { sub } = request.user;

    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        permissions: users.permissions,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, sub))
      .limit(1);

    if (!user) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    return reply.send({ user });
  });

  // PATCH /api/user/me
  app.patch('/me', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const parsed = patchMeBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { sub } = request.user;

    const [user] = await db
      .update(users)
      .set({ nickname: parsed.data.nickname })
      .where(eq(users.id, sub))
      .returning({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        permissions: users.permissions,
        createdAt: users.createdAt,
      });

    if (!user) {
      return reply.status(404).send({ error: '用户不存在' });
    }

    return reply.send({ user });
  });

  // PATCH /api/user/me/password
  app.patch('/me/password', { preHandler: [app.verifyJWT] }, async (request, reply) => {
    const parsed = changePasswordBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { oldPassword, newPassword } = parsed.data;
    const { sub } = request.user;

    const [auth] = await db
      .select()
      .from(userPasswordAuth)
      .where(eq(userPasswordAuth.userId, sub))
      .limit(1);

    if (!auth) {
      return reply.status(400).send({ error: '该账号未设置密码，无法修改' });
    }

    const valid = await argon2.verify(auth.passwordHash, oldPassword);
    if (!valid) {
      return reply.status(401).send({ error: '原密码错误' });
    }

    const newHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await db
      .update(userPasswordAuth)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(userPasswordAuth.userId, sub));

    return reply.send({ message: '密码修改成功' });
  });
}
