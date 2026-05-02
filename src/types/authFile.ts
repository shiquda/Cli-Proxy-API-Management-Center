/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

import type { RecentRequestBucket } from '@/utils/recentRequests';

export type AuthFileType =
  | 'qwen'
  | 'kimi'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  size?: number;
  authIndex?: string | number | null;
  'auth-index'?: string | number | null;
  auth_index?: string | number | null;
  chatgpt_account_id?: string | null;
  chatgptAccountId?: string | null;
  id_token?: unknown;
  idToken?: unknown;
  plan_type?: string | null;
  planType?: string | null;
  chatgpt_subscription_active_start?: string | number | null;
  chatgptSubscriptionActiveStart?: string | number | null;
  chatgpt_subscription_active_until?: string | number | null;
  chatgptSubscriptionActiveUntil?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  unavailable?: boolean;
  status?: string;
  statusMessage?: string;
  lastRefresh?: string | number;
  modified?: number;
  success?: unknown;
  failed?: unknown;
  recent_requests?: RecentRequestBucket[];
  recentRequests?: RecentRequestBucket[];
  [key: string]: unknown;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}
