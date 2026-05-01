/**
 * Generic quota card component.
 */

import { useTranslation } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { normalizePlanType, resolveCodexSubscriptionInfo, TYPE_COLORS } from '@/utils/quota';
import { formatDateTime } from '@/utils/format';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';
const PREMIUM_CODEX_PLAN_TYPES = new Set(['pro', 'prolite', 'pro-lite', 'pro_lite']);

const getCodexPlanLabel = (t: TFunction, planType?: string | null): string | null => {
  const normalized = normalizePlanType(planType);
  if (!normalized) return null;
  if (normalized === 'pro') return t('codex_quota.plan_pro');
  if (PREMIUM_CODEX_PLAN_TYPES.has(normalized) && normalized !== 'pro') {
    return t('codex_quota.plan_prolite');
  }
  if (normalized === 'plus') return t('codex_quota.plan_plus');
  if (normalized === 'team') return t('codex_quota.plan_team');
  if (normalized === 'free') return t('codex_quota.plan_free');
  if (normalized === 'go') return t('codex_quota.plan_go');
  return planType || normalized;
};

const formatSubscriptionDate = (valueMs: number | null): string => {
  if (valueMs === null) return '-';
  return formatDateTime(new Date(valueMs));
};

export interface QuotaStatusState {
  status: QuotaStatus;
  error?: string;
  errorStatus?: number;
}

export interface QuotaProgressBarProps {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
}

export function QuotaProgressBar({
  percent,
  highThreshold,
  mediumThreshold
}: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? styles.quotaBarFillMedium
      : normalized >= highThreshold
        ? styles.quotaBarFillHigh
        : normalized >= mediumThreshold
          ? styles.quotaBarFillMedium
          : styles.quotaBarFillLow;
  const widthPercent = Math.round(normalized ?? 0);

  return (
    <div className={styles.quotaBar}>
      <div
        className={`${styles.quotaBarFill} ${fillClass}`}
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}

export interface QuotaRenderHelpers {
  styles: typeof styles;
  QuotaProgressBar: (props: QuotaProgressBarProps) => ReactElement;
}

interface QuotaCardProps<TState extends QuotaStatusState> {
  item: AuthFileItem;
  quota?: TState;
  resolvedTheme: ResolvedTheme;
  i18nPrefix: string;
  cardIdleMessageKey?: string;
  cardClassName: string;
  defaultType: string;
  canRefresh?: boolean;
  onRefresh?: () => void;
  renderQuotaItems: (
    quota: TState,
    t: TFunction,
    helpers: QuotaRenderHelpers,
    item: AuthFileItem
  ) => ReactNode;
}

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardIdleMessageKey,
  cardClassName,
  defaultType,
  canRefresh = false,
  onRefresh,
  renderQuotaItems
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();

  const displayType = item.type || item.provider || defaultType;
  const normalizedDisplayType = String(displayType).trim().toLowerCase();
  const typeColorSet = TYPE_COLORS[displayType] || TYPE_COLORS.unknown;
  const typeColor: ThemeColors =
    resolvedTheme === 'dark' && typeColorSet.dark ? typeColorSet.dark : typeColorSet.light;

  const quotaStatus = quota?.status ?? 'idle';
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const idleMessageKey = onRefresh ? `${i18nPrefix}.idle` : (cardIdleMessageKey ?? `${i18nPrefix}.idle`);
  const codexSubscription =
    normalizedDisplayType === 'codex'
      ? resolveCodexSubscriptionInfo(item, { useMockFallback: import.meta.env.DEV })
      : null;
  const codexPlanLabel = getCodexPlanLabel(t, codexSubscription?.planType);
  const codexSubscriptionExpired =
    (codexSubscription?.activeUntilMs ?? null) !== null &&
    (codexSubscription?.activeUntilMs ?? 0) < Date.now();

  const getTypeLabel = (type: string): string => {
    const key = `auth_files.filter_${type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    if (type.toLowerCase() === 'iflow') return 'iFlow';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className={`${styles.fileCard} ${cardClassName}`}>
      <div className={styles.cardHeader}>
        <span
          className={styles.typeBadge}
          style={{
            backgroundColor: typeColor.bg,
            color: typeColor.text,
            ...(typeColor.border ? { border: typeColor.border } : {})
          }}
        >
          {getTypeLabel(displayType)}
        </span>
        <span className={styles.fileName}>{item.name}</span>
      </div>

      {codexSubscription && (
        <div className={styles.subscriptionPanel}>
          <div className={styles.subscriptionItem}>
            <span className={styles.subscriptionLabel}>
              {t('auth_files.subscription_plan')}
            </span>
            <span
              className={`${styles.subscriptionValue} ${
                PREMIUM_CODEX_PLAN_TYPES.has(normalizePlanType(codexSubscription.planType) ?? '')
                  ? styles.subscriptionValuePremium
                  : ''
              }`}
            >
              {codexPlanLabel || '-'}
            </span>
          </div>
          <div className={styles.subscriptionItem}>
            <span className={styles.subscriptionLabel}>
              {t('auth_files.subscription_active_start')}
            </span>
            <span className={styles.subscriptionValue}>
              {formatSubscriptionDate(codexSubscription.activeStartMs)}
            </span>
          </div>
          <div className={styles.subscriptionItem}>
            <span className={styles.subscriptionLabel}>
              {t('auth_files.subscription_active_until')}
            </span>
            <span
              className={`${styles.subscriptionValue} ${
                codexSubscriptionExpired ? styles.subscriptionValueExpired : ''
              }`}
            >
              {formatSubscriptionDate(codexSubscription.activeUntilMs)}
            </span>
          </div>
          {codexSubscription.isMock && (
            <span className={styles.subscriptionMockBadge}>
              {t('auth_files.subscription_mock')}
            </span>
          )}
        </div>
      )}

      <div className={styles.quotaSection}>
        {quotaStatus === 'loading' ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.loading`)}</div>
        ) : quotaStatus === 'idle' ? (
          onRefresh ? (
            <button
              type="button"
              className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
              onClick={onRefresh}
              disabled={!canRefresh}
            >
              {t(idleMessageKey)}
            </button>
          ) : (
            <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
          )
        ) : quotaStatus === 'error' ? (
          <div className={styles.quotaError}>
            {t(`${i18nPrefix}.load_failed`, {
              message: quotaErrorMessage
            })}
          </div>
        ) : quota ? (
          renderQuotaItems(quota, t, { styles, QuotaProgressBar }, item)
        ) : (
          <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
        )}
      </div>
    </div>
  );
}

const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string
): string => {
  if (status === 404) return t('common.quota_update_required');
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
