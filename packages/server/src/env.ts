import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().url().default('postgres://coxr_user:coxr_password@localhost:5432/coxr'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32).default('change_this_secret_in_production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('CoXR'),
  WEBAUTHN_RP_ORIGIN: z.string().default('https://localhost:5173'),
  // mediasoup SFU
  MEDIASOUP_LISTEN_IP: z.string().default('0.0.0.0'),
  MEDIASOUP_ANNOUNCED_IP: z.string().default('127.0.0.1'),
  MEDIASOUP_RTC_MIN_PORT: z.coerce.number().int().positive().default(10000),
  MEDIASOUP_RTC_MAX_PORT: z.coerce.number().int().positive().default(10099),
  // AI 推荐（OpenAI 兼容接口）—— 可选，未配置时相关接口返回 503
  OPENAI_API_URL: z.string().default(''),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default(''),
});

export const env = schema.parse(process.env);
