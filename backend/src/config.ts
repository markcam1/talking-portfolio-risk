import 'dotenv/config';
import { z } from 'zod';
import path from 'path';

const schema = z.object({
  PORT: z.coerce.number().default(5179),
  WEB_PORT: z.coerce.number().default(5180),
  OPTIMIZER_BASE_URL: z.string().default('http://127.0.0.1:8077'),
  CALL_AGENT_BASE_URL: z.string().default('http://127.0.0.1:3334'),
  DB_PATH: z.string().default('./data/talking-portfolio.sqlite'),
  DATA_DIR: z.string().default('./data'),
  LOG_DIR: z.string().default('./logs'),
  OWNED_NUMBERS_ONLY: z.string().transform(v => v !== 'false').default('true'),
  DEFAULT_POLICY_ID: z.string().default('self'),
  SELF_CALL_IGNORE_WINDOW: z.string().transform(v => v !== 'false').default('true'),
  CALLING_WINDOW_START: z.string().default('08:00'),
  CALLING_WINDOW_END: z.string().default('21:00'),
  FREQUENCY_CAP_PER_DAY: z.coerce.number().default(1),
  MOCK_MODE: z.string().transform(v => v !== 'false').default('true'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('Talking Portfolio <noreply@example.com>'),
  COMPLIANCE_BCC: z.string().default(''),
  DEFAULT_ENTITY_NAME: z.string().default('Your Name'),
  DEFAULT_CALLBACK_NUMBER: z.string().default('+15550001234'),
  MOCK_CALL_TARGET: z.string().optional(),
  APPROVAL_REQUIRED: z.string().transform(v => v === 'true').default('false'),
  EVENT_TRIGGERS_ENABLED: z.string().transform(v => v === 'true').default('false'),
  INBOUND_ENABLED: z.string().transform(v => v === 'true').default('false'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;

export const DATA_DIR = path.resolve(config.DATA_DIR);
export const LOG_DIR = path.resolve(config.LOG_DIR);
export const COMPLIANCE_DIR = path.join(DATA_DIR, 'compliance');
