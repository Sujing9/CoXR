import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema/index.js';
import { env } from '../env.js';

const client = postgres(env.DATABASE_URL);

export const db = drizzle(client, { schema });

export type Database = typeof db;