/**
 * Weighted Codex quota aggregation helpers.
 */

import type { AuthFileItem, CodexQuotaState, CodexQuotaWindow } from '@/types';
import { normalizePlanType } from './parsers';

type CodexAggregateWindowId = 'fiveHour' | 'sevenDay';

export interface CodexPlanWeights {
  fiveHour: number;
  sevenDay: number;
}

export interface CodexPlanBucket {
  id: string;
  labelKey: string;
  weights: CodexPlanWeights;
}

export interface CodexAggregatePlanBreakdown {
  bucketId: string;
  labelKey: string;
  accounts: number;
  fiveHourCapacity: number;
  sevenDayCapacity: number;
}

export interface CodexAggregateRecovery {
  resetAtSeconds: number;
  capacity: number;
  percent: number;
}

export interface CodexAggregateWindow {
  id: CodexAggregateWindowId;
  labelKey: string;
  totalCapacity: number;
  remainingCapacity: number;
  remainingPercent: number | null;
  includedAccounts: number;
  unavailableAccounts: number;
  nextRecovery: CodexAggregateRecovery | null;
  fullRecoveryAtSeconds: number | null;
  missingResetAccounts: number;
}

export interface CodexAggregateSummary {
  totalCredentials: number;
  loadedCredentials: number;
  includedAccounts: number;
  loadingCredentials: number;
  idleCredentials: number;
  errorCredentials: number;
  unknownPlanAccounts: number;
  planBreakdown: CodexAggregatePlanBreakdown[];
  fiveHour: CodexAggregateWindow;
  sevenDay: CodexAggregateWindow;
}

const CODEX_PLAN_BUCKETS: Record<string, CodexPlanBucket> = {
  free: {
    id: 'free',
    labelKey: 'codex_quota.plan_free',
    weights: { fiveHour: 0, sevenDay: 0.05 },
  },
  go: {
    id: 'go',
    labelKey: 'codex_quota.plan_go',
    weights: { fiveHour: 0, sevenDay: 0.05 },
  },
  plus: {
    id: 'plus',
    labelKey: 'codex_quota.plan_plus',
    weights: { fiveHour: 1, sevenDay: 1 },
  },
  team: {
    id: 'team',
    labelKey: 'codex_quota.plan_team',
    weights: { fiveHour: 1, sevenDay: 1 },
  },
  prolite: {
    id: 'prolite',
    labelKey: 'codex_quota.plan_prolite',
    weights: { fiveHour: 10, sevenDay: 10 },
  },
  pro: {
    id: 'pro',
    labelKey: 'codex_quota.plan_pro',
    weights: { fiveHour: 25, sevenDay: 20 },
  },
};

const PLAN_ALIASES: Record<string, keyof typeof CODEX_PLAN_BUCKETS> = {
  free: 'free',
  go: 'go',
  plus: 'plus',
  team: 'team',
  pro: 'pro',
  'pro-200': 'pro',
  pro200: 'pro',
  pro_200: 'pro',
  prolite: 'prolite',
  'pro-lite': 'prolite',
  pro_lite: 'prolite',
  'pro-100': 'prolite',
  pro100: 'prolite',
  pro_100: 'prolite',
};

const MAIN_WINDOW_IDS: Record<CodexAggregateWindowId, string> = {
  fiveHour: 'five-hour',
  sevenDay: 'weekly',
};

const WINDOW_LABEL_KEYS: Record<CodexAggregateWindowId, string> = {
  fiveHour: 'codex_quota.primary_window',
  sevenDay: 'codex_quota.secondary_window',
};

const resolvePlanBucket = (planType?: string | null): CodexPlanBucket | null => {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  const bucketKey = PLAN_ALIASES[normalized];
  return bucketKey ? CODEX_PLAN_BUCKETS[bucketKey] : null;
};

const findMainWindow = (
  windows: CodexQuotaWindow[],
  id: CodexAggregateWindowId
): CodexQuotaWindow | null => {
  const targetId = MAIN_WINDOW_IDS[id];
  return windows.find((window) => window.id === targetId) ?? null;
};

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const buildEmptyWindow = (id: CodexAggregateWindowId): CodexAggregateWindow => ({
  id,
  labelKey: WINDOW_LABEL_KEYS[id],
  totalCapacity: 0,
  remainingCapacity: 0,
  remainingPercent: null,
  includedAccounts: 0,
  unavailableAccounts: 0,
  nextRecovery: null,
  fullRecoveryAtSeconds: null,
  missingResetAccounts: 0,
});

interface AccountQuotaEntry {
  bucket: CodexPlanBucket;
  windows: CodexQuotaWindow[];
}

function aggregateWindow(
  id: CodexAggregateWindowId,
  accounts: AccountQuotaEntry[]
): CodexAggregateWindow {
  const result = buildEmptyWindow(id);
  const recoveryByReset = new Map<number, number>();

  accounts.forEach((account) => {
    const capacity = account.bucket.weights[id];
    if (capacity <= 0) return;

    const window = findMainWindow(account.windows, id);
    if (!window || window.usedPercent === null) {
      result.unavailableAccounts += 1;
      return;
    }

    const usedPercent = clampPercent(window.usedPercent);
    const usedCapacity = capacity * (usedPercent / 100);
    result.totalCapacity += capacity;
    result.remainingCapacity += capacity - usedCapacity;
    result.includedAccounts += 1;

    if (usedCapacity <= 0) return;

    const resetAtSeconds = window.resetAtSeconds ?? null;
    if (resetAtSeconds === null || resetAtSeconds * 1000 <= Date.now()) {
      result.missingResetAccounts += 1;
      return;
    }

    recoveryByReset.set(
      resetAtSeconds,
      (recoveryByReset.get(resetAtSeconds) ?? 0) + usedCapacity
    );
    result.fullRecoveryAtSeconds = Math.max(result.fullRecoveryAtSeconds ?? 0, resetAtSeconds);
  });

  if (result.totalCapacity > 0) {
    result.remainingPercent = (result.remainingCapacity / result.totalCapacity) * 100;
  }

  let earliestReset: number | null = null;
  recoveryByReset.forEach((_, resetAtSeconds) => {
    if (earliestReset === null || resetAtSeconds < earliestReset) {
      earliestReset = resetAtSeconds;
    }
  });

  if (earliestReset !== null && result.totalCapacity > 0) {
    const capacity = recoveryByReset.get(earliestReset) ?? 0;
    result.nextRecovery = {
      resetAtSeconds: earliestReset,
      capacity,
      percent: (capacity / result.totalCapacity) * 100,
    };
  }

  return result;
}

export function buildCodexAggregateSummary(
  files: AuthFileItem[],
  quotaByFile: Record<string, CodexQuotaState>
): CodexAggregateSummary {
  const planBreakdown = new Map<string, CodexAggregatePlanBreakdown>();
  const accounts: AccountQuotaEntry[] = [];
  let loadingCredentials = 0;
  let idleCredentials = 0;
  let errorCredentials = 0;
  let loadedCredentials = 0;
  let unknownPlanAccounts = 0;

  files.forEach((file) => {
    const quota = quotaByFile[file.name];
    const status = quota?.status ?? 'idle';
    if (status === 'loading') loadingCredentials += 1;
    if (status === 'idle') idleCredentials += 1;
    if (status === 'error') errorCredentials += 1;
    if (status !== 'success') return;

    loadedCredentials += 1;
    const bucket = resolvePlanBucket(quota.planType);
    if (!bucket) {
      unknownPlanAccounts += 1;
      return;
    }

    const currentBreakdown = planBreakdown.get(bucket.id) ?? {
      bucketId: bucket.id,
      labelKey: bucket.labelKey,
      accounts: 0,
      fiveHourCapacity: 0,
      sevenDayCapacity: 0,
    };
    currentBreakdown.accounts += 1;
    currentBreakdown.fiveHourCapacity += bucket.weights.fiveHour;
    currentBreakdown.sevenDayCapacity += bucket.weights.sevenDay;
    planBreakdown.set(bucket.id, currentBreakdown);

    accounts.push({
      bucket,
      windows: quota.windows ?? [],
    });
  });

  return {
    totalCredentials: files.length,
    loadedCredentials,
    includedAccounts: accounts.length,
    loadingCredentials,
    idleCredentials,
    errorCredentials,
    unknownPlanAccounts,
    planBreakdown: Array.from(planBreakdown.values()),
    fiveHour: aggregateWindow('fiveHour', accounts),
    sevenDay: aggregateWindow('sevenDay', accounts),
  };
}
