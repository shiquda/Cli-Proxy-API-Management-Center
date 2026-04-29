import { useCallback, useMemo } from 'react';
import { collectUsageDetails, extractTotalTokens } from '@/utils/usage';
import type { UsagePayload } from './useUsageData';

export interface SparklineData {
  labels: string[];
  datasets: [
    {
      data: number[];
      borderColor: string;
      backgroundColor: string;
      fill: boolean;
      tension: number;
      pointRadius: number;
      borderWidth: number;
    }
  ];
}

export interface SparklineBundle {
  data: SparklineData;
}

export interface UseSparklinesOptions {
  usage: UsagePayload | null;
  loading: boolean;
  nowMs: number;
}

export interface UseSparklinesReturn {
  requestsSparkline: SparklineBundle | null;
  tokensSparkline: SparklineBundle | null;
  cacheRateSparkline: SparklineBundle | null;
  successRateSparkline: SparklineBundle | null;
  rpmSparkline: SparklineBundle | null;
  tpmSparkline: SparklineBundle | null;
  costSparkline: SparklineBundle | null;
}

const getCachedTokens = (detail: ReturnType<typeof collectUsageDetails>[number]): number => {
  const tokens = detail.tokens;
  return Math.max(
    typeof tokens.cached_tokens === 'number' ? Math.max(tokens.cached_tokens, 0) : 0,
    typeof tokens.cache_tokens === 'number' ? Math.max(tokens.cache_tokens, 0) : 0
  );
};

const getInputTokens = (detail: ReturnType<typeof collectUsageDetails>[number]): number => {
  const tokens = detail.tokens;
  return typeof tokens.input_tokens === 'number' ? Math.max(tokens.input_tokens, 0) : 0;
};

export function useSparklines({ usage, loading, nowMs }: UseSparklinesOptions): UseSparklinesReturn {
  const lastHourSeries = useMemo(() => {
    if (!usage) {
      return { labels: [], requests: [], tokens: [], cacheRate: [], successRate: [] };
    }
    if (!Number.isFinite(nowMs) || nowMs <= 0) {
      return { labels: [], requests: [], tokens: [], cacheRate: [], successRate: [] };
    }
    const details = collectUsageDetails(usage);
    if (!details.length) {
      return { labels: [], requests: [], tokens: [], cacheRate: [], successRate: [] };
    }

    const windowMinutes = 60;
    const now = nowMs;
    const windowStart = now - windowMinutes * 60 * 1000;
    const requestBuckets = new Array(windowMinutes).fill(0);
    const tokenBuckets = new Array(windowMinutes).fill(0);
    const successBuckets = new Array(windowMinutes).fill(0);
    const inputTokenBuckets = new Array(windowMinutes).fill(0);
    const cachedTokenBuckets = new Array(windowMinutes).fill(0);

    details.forEach((detail) => {
      const timestamp = detail.__timestampMs ?? 0;
      if (!Number.isFinite(timestamp) || timestamp < windowStart || timestamp > now) {
        return;
      }
      const minuteIndex = Math.min(
        windowMinutes - 1,
        Math.floor((timestamp - windowStart) / 60000)
      );
      requestBuckets[minuteIndex] += 1;
      tokenBuckets[minuteIndex] += extractTotalTokens(detail);
      if (!detail.failed) {
        successBuckets[minuteIndex] += 1;
      }
      inputTokenBuckets[minuteIndex] += getInputTokens(detail);
      cachedTokenBuckets[minuteIndex] += getCachedTokens(detail);
    });

    const labels = requestBuckets.map((_, idx) => {
      const date = new Date(windowStart + (idx + 1) * 60000);
      const h = date.getHours().toString().padStart(2, '0');
      const m = date.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    const cacheRateBuckets = cachedTokenBuckets.map((cached, idx) => {
      const input = inputTokenBuckets[idx];
      return input > 0 ? (cached / input) * 100 : 0;
    });
    const successRateBuckets = successBuckets.map((success, idx) => {
      const total = requestBuckets[idx];
      return total > 0 ? (success / total) * 100 : 0;
    });

    return {
      labels,
      requests: requestBuckets,
      tokens: tokenBuckets,
      cacheRate: cacheRateBuckets,
      successRate: successRateBuckets,
    };
  }, [nowMs, usage]);

  const buildSparkline = useCallback(
    (
      series: { labels: string[]; data: number[] },
      color: string,
      backgroundColor: string
    ): SparklineBundle | null => {
      if (loading || !series?.data?.length) {
        return null;
      }
      const sliceStart = Math.max(series.data.length - 60, 0);
      const labels = series.labels.slice(sliceStart);
      const points = series.data.slice(sliceStart);
      return {
        data: {
          labels,
          datasets: [
            {
              data: points,
              borderColor: color,
              backgroundColor,
              fill: true,
              tension: 0.45,
              pointRadius: 0,
              borderWidth: 2
            }
          ]
        }
      };
    },
    [loading]
  );

  const requestsSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.requests },
        '#8b8680',
        'rgba(139, 134, 128, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.requests]
  );

  const tokensSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#8b5cf6',
        'rgba(139, 92, 246, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  const rpmSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.requests },
        '#22c55e',
        'rgba(34, 197, 94, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.requests]
  );

  const cacheRateSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.cacheRate },
        '#06b6d4',
        'rgba(6, 182, 212, 0.18)'
      ),
    [buildSparkline, lastHourSeries.cacheRate, lastHourSeries.labels]
  );

  const successRateSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.successRate },
        '#10b981',
        'rgba(16, 185, 129, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.successRate]
  );

  const tpmSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#f97316',
        'rgba(249, 115, 22, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  const costSparkline = useMemo(
    () =>
      buildSparkline(
        { labels: lastHourSeries.labels, data: lastHourSeries.tokens },
        '#f59e0b',
        'rgba(245, 158, 11, 0.18)'
      ),
    [buildSparkline, lastHourSeries.labels, lastHourSeries.tokens]
  );

  return {
    requestsSparkline,
    tokensSparkline,
    cacheRateSparkline,
    successRateSparkline,
    rpmSparkline,
    tpmSparkline,
    costSparkline
  };
}
