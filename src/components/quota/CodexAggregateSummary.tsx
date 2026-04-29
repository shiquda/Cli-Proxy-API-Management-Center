import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { AuthFileItem, CodexQuotaState } from '@/types';
import {
  buildCodexAggregateSummary,
  formatUnixSeconds,
  type CodexAggregateWindow,
} from '@/utils/quota';
import { QuotaProgressBar } from './QuotaCard';
import styles from '@/pages/QuotaPage.module.scss';

interface CodexAggregateSummaryProps {
  files: AuthFileItem[];
  quota: Record<string, CodexQuotaState>;
}

const formatPercent = (value: number | null): string =>
  value === null ? '--' : `${Math.max(0, Math.min(100, value)).toFixed(1)}%`;

const formatCapacity = (value: number): string =>
  Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);

function CodexAggregateWindowRow({ window }: { window: CodexAggregateWindow }) {
  const { t } = useTranslation();
  const remainingPercent = window.remainingPercent;
  const percentLabel = formatPercent(remainingPercent);
  const capacityLabel =
    window.totalCapacity > 0
      ? t('codex_quota.aggregate_capacity', {
          remaining: formatCapacity(window.remainingCapacity),
          total: formatCapacity(window.totalCapacity),
        })
      : t('codex_quota.aggregate_no_capacity');
  const nextRecovery = window.nextRecovery
    ? t('codex_quota.aggregate_next_recovery', {
        time: formatUnixSeconds(window.nextRecovery.resetAtSeconds),
        percent: window.nextRecovery.percent.toFixed(1),
        capacity: formatCapacity(window.nextRecovery.capacity),
      })
    : t('codex_quota.aggregate_no_recovery');
  const fullRecovery = window.fullRecoveryAtSeconds
    ? t('codex_quota.aggregate_full_recovery', {
        time: formatUnixSeconds(window.fullRecoveryAtSeconds),
      })
    : t('codex_quota.aggregate_full_recovery_unknown');
  const warningParts = [
    window.unavailableAccounts > 0
      ? t('codex_quota.aggregate_unavailable_accounts', {
          count: window.unavailableAccounts,
        })
      : null,
    window.missingResetAccounts > 0
      ? t('codex_quota.aggregate_missing_reset_accounts', {
          count: window.missingResetAccounts,
        })
      : null,
  ].filter(Boolean);

  return (
    <div className={styles.codexAggregateWindow}>
      <div className={styles.codexAggregateWindowHeader}>
        <span className={styles.quotaModel}>{t(window.labelKey)}</span>
        <span className={styles.quotaPercent}>{percentLabel}</span>
      </div>
      <QuotaProgressBar percent={remainingPercent} highThreshold={70} mediumThreshold={30} />
      <div className={styles.codexAggregateMeta}>
        <span>{capacityLabel}</span>
        <span>{nextRecovery}</span>
        <span>{fullRecovery}</span>
      </div>
      {warningParts.length > 0 && (
        <div className={styles.codexAggregateWarning}>{warningParts.join(' · ')}</div>
      )}
    </div>
  );
}

export function CodexAggregateSummary({ files, quota }: CodexAggregateSummaryProps) {
  const { t } = useTranslation();
  const summary = useMemo(() => buildCodexAggregateSummary(files, quota), [files, quota]);
  const planParts = summary.planBreakdown.map((item) =>
    t('codex_quota.aggregate_plan_part', {
      plan: t(item.labelKey),
      count: item.accounts,
      fiveHour: formatCapacity(item.fiveHourCapacity),
      sevenDay: formatCapacity(item.sevenDayCapacity),
    })
  );
  const statusParts = [
    t('codex_quota.aggregate_loaded', {
      loaded: summary.loadedCredentials,
      total: summary.totalCredentials,
    }),
    summary.includedAccounts > 0
      ? t('codex_quota.aggregate_included', { count: summary.includedAccounts })
      : null,
    summary.unknownPlanAccounts > 0
      ? t('codex_quota.aggregate_unknown_plans', { count: summary.unknownPlanAccounts })
      : null,
    summary.errorCredentials > 0
      ? t('codex_quota.aggregate_errors', { count: summary.errorCredentials })
      : null,
    summary.loadingCredentials > 0
      ? t('codex_quota.aggregate_loading', { count: summary.loadingCredentials })
      : null,
    summary.idleCredentials > 0
      ? t('codex_quota.aggregate_idle', { count: summary.idleCredentials })
      : null,
  ].filter(Boolean);

  return (
    <div className={styles.codexAggregatePanel}>
      <div className={styles.codexAggregateHeader}>
        <div>
          <div className={styles.codexAggregateTitle}>
            {t('codex_quota.aggregate_title')}
          </div>
          <div className={styles.codexAggregateSubtitle}>
            {t('codex_quota.aggregate_subtitle')}
          </div>
        </div>
        <div className={styles.codexAggregateStatus}>{statusParts.join(' · ')}</div>
      </div>

      {planParts.length > 0 && (
        <div className={styles.codexAggregatePlans}>{planParts.join(' · ')}</div>
      )}

      <div className={styles.codexAggregateWindows}>
        <CodexAggregateWindowRow window={summary.fiveHour} />
        <CodexAggregateWindowRow window={summary.sevenDay} />
      </div>
    </div>
  );
}
