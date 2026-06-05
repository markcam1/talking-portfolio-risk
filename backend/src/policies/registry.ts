import { selfCallPolicy } from './selfCallPolicy.js';
import { managedClientPolicy } from './managedClientPolicy.js';
import type { RecipientPolicy } from './types.js';

const policies = new Map<string, RecipientPolicy>([
  ['self', selfCallPolicy],
  ['managed_client', managedClientPolicy],
]);

export const policyRegistry = {
  get(id: string): RecipientPolicy {
    const policy = policies.get(id);
    if (!policy) throw new Error(`Unknown policy: ${id}`);
    return policy;
  },
  has(id: string): boolean {
    return policies.has(id);
  },
};
