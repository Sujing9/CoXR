import { pgTable, uuid, varchar, timestamp, customType } from 'drizzle-orm/pg-core';

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

// ─── space_snapshots ──────────────────────────────────────────────────────────

export const spaceSnapshots = pgTable('space_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  yjsDocument: bytea('yjs_document').notNull(),
  createdByUserId: uuid('created_by_user_id').notNull(),
  createdAt: timestamptz('created_at').notNull().defaultNow(),
});
