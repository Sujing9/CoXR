import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { lookup as dnsLookup } from 'node:dns/promises';
import { writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import postgres from 'postgres';
import Database from 'better-sqlite3';

// ─── SSRF Protection ──────────────────────────────────────────────────────────

const PRIVATE_PATTERNS = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\./,
    /^::1$/,
    /^fd[0-9a-f]{2}:/i,
    /^fe[89ab][0-9a-f]:/i,
];

function validatePublicHost(host: string): void {
    const h = host.trim();
    for (const p of PRIVATE_PATTERNS) {
        if (p.test(h)) throw new Error('不允许访问私有或内部地址');
    }
}

async function assertPublicHost(hostname: string): Promise<void> {
    validatePublicHost(hostname);
    try {
        const addrs = await dnsLookup(hostname, { all: true });
        for (const { address } of addrs) validatePublicHost(address);
    } catch (e: any) {
        if (e.message === '不允许访问私有或内部地址') throw e;
        throw new Error(`DNS 解析失败: ${e.message}`);
    }
}

const MAX_ROWS = 10_000;

// ─── Route plugin ─────────────────────────────────────────────────────────────

export default async function importRoutes(app: FastifyInstance) {
    // ── POST /api/import/fetch-url ──────────────────────────────────────────────
    app.post('/fetch-url', { preHandler: [app.verifyJWT] }, async (req, reply) => {
        const bodySchema = z.object({
            url: z.string().url(),
            headers: z.record(z.string()).optional().default({}),
        });

        let parsed: z.infer<typeof bodySchema>;
        try {
            parsed = bodySchema.parse(req.body);
        } catch (e: any) {
            return reply.status(400).send({ error: e.message });
        }

        const { url, headers } = parsed;
        const urlObj = new URL(url);

        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return reply.status(400).send({ error: '只支持 HTTP/HTTPS 协议' });
        }

        try {
            await assertPublicHost(urlObj.hostname);
        } catch (e: any) {
            return reply.status(400).send({ error: e.message });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8_000);

        try {
            const resp = await fetch(url, {
                headers: { 'User-Agent': 'CoXR-Import/1.0', ...headers },
                signal: controller.signal,
            });

            if (!resp.ok) {
                return reply.status(400).send({ error: `HTTP ${resp.status}: ${resp.statusText}` });
            }

            const contentType = resp.headers.get('content-type') ?? '';
            if (!contentType.includes('json')) {
                return reply.status(400).send({ error: '响应 Content-Type 必须包含 application/json' });
            }

            // Stream-limited read (max 5 MB)
            const reader = resp.body?.getReader();
            if (!reader) return reply.status(400).send({ error: '无法读取响应体' });

            const chunks: Buffer[] = [];
            let total = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.length;
                if (total > 5 * 1024 * 1024) {
                    reader.cancel();
                    return reply.status(400).send({ error: '响应体超过 5MB 限制' });
                }
                chunks.push(Buffer.from(value));
            }

            const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            return reply.send({ data });
        } catch (e: any) {
            if (e.name === 'AbortError') {
                return reply.status(408).send({ error: '请求超时（8 秒）' });
            }
            return reply.status(400).send({ error: e.message ?? '请求失败' });
        } finally {
            clearTimeout(timeout);
        }
    });

    // ── POST /api/import/db-query ───────────────────────────────────────────────
    app.post('/db-query', { preHandler: [app.verifyJWT] }, async (req, reply) => {
        const body = req.body as Record<string, unknown>;

        // ── PostgreSQL ────────────────────────────────────────────────────────────
        if (body.type === 'pg') {
            const pgSchema = z.object({
                type: z.literal('pg'),
                action: z.enum(['list_tables', 'query_table']),
                host: z.string().min(1).max(255),
                port: z.coerce.number().int().min(1).max(65535).default(5432),
                database: z.string().min(1).max(255),
                user: z.string().min(1).max(255),
                password: z.string().max(255),
                ssl: z.boolean().default(false),
                schema: z.string().max(255).default('public'),
                table: z.string().max(255).optional(),
            });

            let config: z.infer<typeof pgSchema>;
            try {
                config = pgSchema.parse(body);
            } catch (e: any) {
                return reply.status(400).send({ error: e.message });
            }

            try {
                await assertPublicHost(config.host);
            } catch (e: any) {
                return reply.status(400).send({ error: e.message });
            }

            const sql = postgres({
                host: config.host,
                port: config.port,
                database: config.database,
                username: config.user,
                password: config.password,
                ssl: config.ssl ? 'require' : false,
                max: 1,
                idle_timeout: 10,
                connect_timeout: 10,
            });

            try {
                if (config.action === 'list_tables') {
                    const tables = await sql`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_type = 'BASE TABLE'
            ORDER BY table_schema, table_name
          `;
                    return reply.send({
                        tables: tables.map((t) => ({ schema: t.table_schema, name: t.table_name })),
                    });
                } else {
                    if (!config.table) return reply.status(400).send({ error: '缺少 table 参数' });

                    // Verify table exists via parameterized query (prevents injection)
                    const exists = await sql`
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${config.schema}
              AND table_name = ${config.table}
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
            LIMIT 1
          `;
                    if (exists.length === 0) return reply.status(404).send({ error: '数据表不存在' });

                    // Safe identifier quoting: double any embedded double-quotes
                    const schemaEsc = config.schema.replace(/"/g, '""');
                    const tableEsc = config.table.replace(/"/g, '""');
                    const rows = await sql.unsafe(
                        `SELECT * FROM "${schemaEsc}"."${tableEsc}" LIMIT ${MAX_ROWS}`,
                    );

                    if (!rows[0]) {
                        throw new Error();
                    }

                    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                    return reply.send({ columns, rows: rows.map((r) => ({ ...r })) });
                }
            } catch (e: any) {
                return reply.status(400).send({ error: e.message ?? 'PostgreSQL 查询失败' });
            } finally {
                await sql.end().catch(() => { });
            }

            // ── SQLite ──────────────────────────────────────────────────────────────
        } else if (body.type === 'sqlite') {
            const sqliteSchema = z.object({
                type: z.literal('sqlite'),
                action: z.enum(['list_tables', 'query_table']),
                // base64 of .db file, limit ~27 MB (≈ 20 MB raw)
                fileBase64: z.string().max(27 * 1024 * 1024),
                table: z.string().max(255).optional(),
            });

            let config: z.infer<typeof sqliteSchema>;
            try {
                config = sqliteSchema.parse(body);
            } catch (e: any) {
                return reply.status(400).send({ error: e.message });
            }

            const buffer = Buffer.from(config.fileBase64, 'base64');
            const tmpDir = mkdtempSync(join(tmpdir(), 'coxr-import-'));
            const tmpFile = join(tmpDir, 'import.db');

            try {
                writeFileSync(tmpFile, buffer);
                const db = new Database(tmpFile, { readonly: true });

                try {
                    if (config.action === 'list_tables') {
                        const tables = db
                            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                            .all() as { name: string }[];
                        return reply.send({ tables: tables.map((t) => t.name) });
                    } else {
                        if (!config.table) return reply.status(400).send({ error: '缺少 table 参数' });

                        const exists = db
                            .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?")
                            .get(config.table);
                        if (!exists) return reply.status(404).send({ error: '数据表不存在' });

                        const tableEsc = config.table.replace(/"/g, '""');
                        const rows = db
                            .prepare(`SELECT * FROM "${tableEsc}" LIMIT ${MAX_ROWS}`)
                            .all() as Record<string, unknown>[];

                        if (!rows[0]) {
                            throw new Error();
                        }

                        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
                        return reply.send({ columns, rows });
                    }
                } finally {
                    db.close();
                }
            } catch (e: any) {
                return reply.status(400).send({ error: e.message ?? 'SQLite 查询失败' });
            } finally {
                try {
                    unlinkSync(tmpFile);
                    rmdirSync(tmpDir);
                } catch {
                    // ignore cleanup errors
                }
            }
        } else {
            return reply.status(400).send({ error: '不支持的数据库类型，仅支持 pg / sqlite' });
        }
    });
}
