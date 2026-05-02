/**
 * Resolver functions for extracting data from auth files.
 */

import type { AuthFileItem } from '@/types';
import {
  normalizeStringValue,
  normalizePlanType,
  parseIdTokenPayload
} from './parsers';
import { parseTimestampMs } from '../timestamp';

export interface CodexSubscriptionInfo {
  planType: string | null;
  activeStartMs: number | null;
  activeUntilMs: number | null;
  activeStartRaw?: unknown;
  activeUntilRaw?: unknown;
  isMock: boolean;
}

const CODEX_SUBSCRIPTION_START_KEYS = [
  'chatgpt_subscription_active_start',
  'chatgptSubscriptionActiveStart',
] as const;

const CODEX_ACCOUNT_ID_KEYS = [
  'chatgpt_account_id',
  'chatgptAccountId',
] as const;

const CODEX_SUBSCRIPTION_UNTIL_KEYS = [
  'chatgpt_subscription_active_until',
  'chatgptSubscriptionActiveUntil',
] as const;

const CODEX_PLAN_TYPE_KEYS = [
  'plan_type',
  'planType',
  'chatgpt_plan_type',
  'chatgptPlanType',
] as const;

const MOCK_CODEX_SUBSCRIPTION_START_MS = Date.UTC(2026, 3, 1, 0, 0, 0);
const MOCK_CODEX_SUBSCRIPTION_UNTIL_MS = Date.UTC(2026, 4, 1, 0, 0, 0);

const getRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeSubscriptionTimestampMs = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const abs = Math.abs(value);
    if (abs < 1e11) return value * 1000;
    if (abs < 1e14) return value;
    if (abs < 1e17) return Math.round(value / 1000);
    return Math.round(value / 1e6);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) {
      return normalizeSubscriptionTimestampMs(asNumber);
    }
    const parsed = parseTimestampMs(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const findFirstMeaningfulField = (
  records: Array<Record<string, unknown> | null>,
  keys: readonly string[]
): unknown => {
  for (const record of records) {
    if (!record) continue;
    for (const key of keys) {
      const value = record[key];
      if (value === null || value === undefined) continue;
      if (typeof value === 'string' && !value.trim()) continue;
      return value;
    }
  }
  return undefined;
};

const getCodexCandidateRecords = (file: AuthFileItem): Array<Record<string, unknown> | null> => {
  const metadata = getRecord(file.metadata);
  const attributes = getRecord(file.attributes);
  const fileIdTokenClaims = parseIdTokenPayload(file.id_token ?? file.idToken);
  const metadataIdTokenClaims = parseIdTokenPayload(metadata?.id_token ?? metadata?.idToken);
  const attributesIdTokenClaims = parseIdTokenPayload(attributes?.id_token ?? attributes?.idToken);

  return [
    file as Record<string, unknown>,
    fileIdTokenClaims,
    metadata,
    metadataIdTokenClaims,
    attributes,
    attributesIdTokenClaims,
  ];
};

export function extractCodexChatgptAccountId(value: unknown): string | null {
  const payload = parseIdTokenPayload(value);
  if (!payload) return null;
  return normalizeStringValue(payload.chatgpt_account_id ?? payload.chatgptAccountId);
}

export function resolveCodexChatgptAccountId(file: AuthFileItem): string | null {
  const records = getCodexCandidateRecords(file);
  return normalizeStringValue(findFirstMeaningfulField(records, CODEX_ACCOUNT_ID_KEYS));
}

export function resolveCodexPlanType(file: AuthFileItem): string | null {
  const records = getCodexCandidateRecords(file);
  return normalizePlanType(findFirstMeaningfulField(records, CODEX_PLAN_TYPE_KEYS));
}

export function resolveCodexSubscriptionInfo(
  file: AuthFileItem,
  options?: { useMockFallback?: boolean }
): CodexSubscriptionInfo | null {
  const records = getCodexCandidateRecords(file);
  const planType = resolveCodexPlanType(file);
  const activeStartRaw = findFirstMeaningfulField(records, CODEX_SUBSCRIPTION_START_KEYS);
  const activeUntilRaw = findFirstMeaningfulField(records, CODEX_SUBSCRIPTION_UNTIL_KEYS);
  const activeStartMs = normalizeSubscriptionTimestampMs(activeStartRaw);
  const activeUntilMs = normalizeSubscriptionTimestampMs(activeUntilRaw);

  if (planType || activeStartMs !== null || activeUntilMs !== null) {
    return {
      planType,
      activeStartMs,
      activeUntilMs,
      activeStartRaw,
      activeUntilRaw,
      isMock: false,
    };
  }

  if (options?.useMockFallback) {
    return {
      planType: 'team',
      activeStartMs: MOCK_CODEX_SUBSCRIPTION_START_MS,
      activeUntilMs: MOCK_CODEX_SUBSCRIPTION_UNTIL_MS,
      activeStartRaw: MOCK_CODEX_SUBSCRIPTION_START_MS,
      activeUntilRaw: MOCK_CODEX_SUBSCRIPTION_UNTIL_MS,
      isMock: true,
    };
  }

  return null;
}

export function extractGeminiCliProjectId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const matches = Array.from(value.matchAll(/\(([^()]+)\)/g));
  if (matches.length === 0) return null;
  const candidate = matches[matches.length - 1]?.[1]?.trim();
  return candidate ? candidate : null;
}

export function resolveGeminiCliProjectId(file: AuthFileItem): string | null {
  const metadata =
    file && typeof file.metadata === 'object' && file.metadata !== null
      ? (file.metadata as Record<string, unknown>)
      : null;
  const attributes =
    file && typeof file.attributes === 'object' && file.attributes !== null
      ? (file.attributes as Record<string, unknown>)
      : null;

  const candidates = [
    file.account,
    file['account'],
    metadata?.account,
    attributes?.account
  ];

  for (const candidate of candidates) {
    const projectId = extractGeminiCliProjectId(candidate);
    if (projectId) return projectId;
  }

  return null;
}
