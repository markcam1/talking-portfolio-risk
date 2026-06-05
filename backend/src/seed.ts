import { db } from './db.js';
import { config } from './config.js';

export async function seedDefaults() {
  const existing = await db.callerProfile.count();
  if (existing > 0) return;

  await db.callerProfile.create({
    data: {
      entityName: config.DEFAULT_ENTITY_NAME,
      callbackNumber: config.DEFAULT_CALLBACK_NUMBER,
      financialDisclaimer: 'Educational use only. Not investment advice.',
      isDefault: true,
    },
  });
  console.log('Seeded default CallerProfile');
}
