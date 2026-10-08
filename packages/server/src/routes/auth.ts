import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as argon2 from 'argon2';
import { eq, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userPasswordAuth } from '../db/schema/index.js';
import {
    hasPermission,
    Permission,
    DEFAULT_USER_PERMISSIONS,
    FIRST_USER_PERMISSIONS,
} from '@coxr/shared';
import { env } from '../env.js';

const registerBody = z.object({
    username: z.string().min(1).max(64),
    nickname: z.string().min(1).max(64),
    password: z.string().min(8).max(128),
});

const loginBody = z.object({
    username: z.string(),
    password: z.string(),
});

export default async function authRoutes(app: FastifyInstance) {
    // POST /api/auth/register
    app.post('/register', async (request, reply) => {
        const parsed = registerBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }
        const { username, nickname, password } = parsed.data;

        // 检查用户名是否已存在
        const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.username, username))
            .limit(1);
        if (existing.length > 0) {
            return reply.status(409).send({ error: '用户名已存在' });
        }

        // 首个用户判断：获取当前用户总数
        const countResult = await db.select({ value: count() }).from(users);
        const userCount = countResult[0]?.value ?? 0;
        const permissions = userCount === 0 ? FIRST_USER_PERMISSIONS : DEFAULT_USER_PERMISSIONS;

        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

        const insertResult = await db
            .insert(users)
            .values({ username, nickname, permissions })
            .returning();
        const user = insertResult[0]!;

        await db.insert(userPasswordAuth).values({ userId: user.id, passwordHash });

        const token = app.jwt.sign(
            { sub: user.id, permissions: user.permissions },
            { expiresIn: env.JWT_EXPIRES_IN },
        );

        return reply.status(201).send({ token, user: { id: user.id, username: user.username, nickname: user.nickname, permissions: user.permissions } });
    });

    // POST /api/auth/login
    app.post('/login', async (request, reply) => {
        const parsed = loginBody.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({ error: parsed.error.flatten() });
        }
        const { username, password } = parsed.data;

        const [user] = await db
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1);

        if (!user) {
            return reply.status(401).send({ error: '用户名或密码错误' });
        }

        // 检查是否具备登录权限
        if (!hasPermission(user.permissions, Permission.LOGIN)) {
            return reply.status(403).send({ error: '账号已被禁止登录' });
        }

        const [auth] = await db
            .select()
            .from(userPasswordAuth)
            .where(eq(userPasswordAuth.userId, user.id))
            .limit(1);

        if (!auth || !(await argon2.verify(auth.passwordHash, password))) {
            return reply.status(401).send({ error: '用户名或密码错误' });
        }

        const token = app.jwt.sign(
            { sub: user.id, permissions: user.permissions },
            { expiresIn: env.JWT_EXPIRES_IN },
        );

        return reply.send({ token, user: { id: user.id, username: user.username, nickname: user.nickname, permissions: user.permissions } });
    });
}
