/**
 * Generic quota card component.
 */

import { useTranslation } from 'react-i18next';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { resolveCodexSubscriptionInfo, TYPE_COLORS } from '@/utils/quota';
import { formatDateTime } from '@/utils/format';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';
type SubscriptionUrgency = 'normal' | 'warning' | 'danger';
const SUBSCRIPTION_WARNING_DAYS = 7;
const SUBSCRIPTION_DANGER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_NOW_MS = Date.now();

const formatSubscriptionDate = (valueMs: number | null): string => {
  if (valueMs === null) return '-';
  return formatDateTime(new Date(valueMs));
};

const formatSubscriptionRemainingDays = (
  t: TFunction,
  valueMs: number | null,
  nowMs: number
): string | null => {
  if (valueMs === null) return null;
  const diffMs = valueMs - nowMs;
  if (diffMs <= 0) {
    return t('auth_files.subscription_expired');
  }
  const days = Math.ceil(diffMs / DAY_MS);
  return t('auth_files.subscription_remaining_days', { count: days });
};

const resolveSubscriptionUrgency = (
  valueMs: number | null,
  nowMs: number
): SubscriptionUrgency => {
  if (valueMs === null) return 'normal';
  const diffMs = valueMs - nowMs;
  if (diffMs <= SUBSCRIPTION_DANGER_DAYS * DAY_MS) return 'danger';
  if (diffMs <= SUBSCRIPTION_WARNING_DAYS * DAY_MS) return 'warning';
  return 'normal';
};

const getSubscriptionUrgencyClass = (
  urgency: SubscriptionUrgency,
  classMap: { warning: string; danger: string }
): string => {
  if (urgency === 'danger') return classMap.danger;
  if (urgency === 'warning') return classMap.warning;
  return '';
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
  const [nowMs, setNowMs] = useState(INITIAL_NOW_MS);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

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
  const codexSubscriptionUrgency = resolveSubscriptionUrgency(
    codexSubscription?.activeUntilMs ?? null,
    nowMs
  );
  const codexSubscriptionRemainingLabel = formatSubscriptionRemainingDays(
    t,
    codexSubscription?.activeUntilMs ?? null,
    nowMs
  );

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
              {t('auth_files.subscription_active_until')}
            </span>
            <span
              className={`${styles.subscriptionValue} ${
                getSubscriptionUrgencyClass(codexSubscriptionUrgency, {
                  warning: styles.subscriptionValueWarning,
                  danger: styles.subscriptionValueDanger,
                })
              }`}
            >
              {formatSubscriptionDate(codexSubscription.activeUntilMs)}
            </span>
          </div>
          {codexSubscriptionRemainingLabel && (
            <span
              className={`${styles.subscriptionRemaining} ${
                getSubscriptionUrgencyClass(codexSubscriptionUrgency, {
                  warning: styles.subscriptionRemainingWarning,
                  danger: styles.subscriptionRemainingDanger,
                })
              }`}
            >
              {codexSubscriptionRemainingLabel}
            </span>
          )}
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
