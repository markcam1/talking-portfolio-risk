// Phase 9 scaffold — event-driven trigger evaluator
// Returns shouldFire: false until EVENT_TRIGGERS_ENABLED and a real evaluator are implemented.

export interface TriggerDecision {
  shouldFire: boolean;
  reason?: string;
}

export interface EventTrigger {
  evaluate(prevRunId: string, latestRunId: string): Promise<TriggerDecision>;
}

export const noopEvaluator: EventTrigger = {
  async evaluate(_prevRunId: string, _latestRunId: string): Promise<TriggerDecision> {
    return { shouldFire: false };
  },
};
