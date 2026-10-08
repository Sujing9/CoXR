import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  text,
  bigint,
  jsonb,
  customType,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ─── users ───────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: varchar('username', { length: 64 }).notNull().unique(),
  nickname: varchar('nickname', { length: 64 }).notNull(),
  permissions: integer('permissions').notNull().default(0),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

// ─── user_password_auth ───────────────────────────────────────────────────────

export const userPasswordAuth = pgTable('user_password_auth', {
  userId: uuid('user_id')
    .primaryKey(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

// ─── user_webauthn_credentials ────────────────────────────────────────────────

export const userWebauthnCredentials = pgTable('user_webauthn_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),
  credentialId: bytea('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),
  signCount: bigint('sign_count', { mode: 'number' }).notNull().default(0),
  transports: jsonb('transports'),
  aaguid: uuid('aaguid').notNull(),
  deviceName: varchar('device_name', { length: 128 }).notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  lastUsedAt: timestamptz('last_used_at'),
});
