import {
  pgTable,
  uuid,
  char,
  smallint,
  timestamp,
  varchar,
  bigserial,
  jsonb,
} from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

// ─── collaboration_spaces ─────────────────────────────────────────────────────

export const collaborationSpaces = pgTable('collaboration_spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  accessCode: char('access_code', { length: 4 }).notNull(),
  creatorUserId: uuid('creator_user_id').notNull(),
  ownerUserId: uuid('owner_user_id').notNull(),
  status: smallint('status').notNull().default(0),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});

// ─── space_members ────────────────────────────────────────────────────────────

export const spaceMembers = pgTable('space_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull(),
  userId: uuid('user_id').notNull(),
  memberRole: smallint('member_role').notNull().default(0),
  memberStatus: smallint('member_status').notNull().default(0),
  lastJoinedAt: timestamptz('last_joined_at'),
  lastLeftAt: timestamptz('last_left_at'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

// ─── space_event_logs ─────────────────────────────────────────────────────────

export const spaceEventLogs = pgTable('space_event_logs', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  spaceId: uuid('space_id').notNull(),
  userId: uuid('user_id').notNull(),
  targetUserId: uuid('target_user_id'),
  eventType: varchar('event_type', { length: 32 }).notNull(),
  eventData: jsonb('event_data'),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
