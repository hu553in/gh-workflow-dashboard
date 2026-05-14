import { describe, expect, test } from 'vitest';

import {
  DEFAULT_POLL_INTERVAL_MS,
  isPollingEnabled,
  normalizePollIntervalMs,
  normalizeRunsLimit,
  POLL_INTERVAL_OPTIONS,
} from './settings.js';

describe('poll interval settings', () => {
  test('defines the supported auto reload intervals with a one-minute default', () => {
    expect(POLL_INTERVAL_OPTIONS).toEqual([
      { value: '0', label: 'Off', ms: 0 },
      { value: '15000', label: '15s', ms: 15_000 },
      { value: '30000', label: '30s', ms: 30_000 },
      { value: '60000', label: '1m', ms: 60_000 },
      { value: '300000', label: '5m', ms: 300_000 },
      { value: '900000', label: '15m', ms: 900_000 },
      { value: '3600000', label: '1h', ms: 3_600_000 },
      { value: '7200000', label: '2h', ms: 7_200_000 },
      { value: '10800000', label: '3h', ms: 10_800_000 },
      { value: '21600000', label: '6h', ms: 21_600_000 },
      { value: '43200000', label: '12h', ms: 43_200_000 },
      { value: '86400000', label: '24h', ms: 86_400_000 },
    ]);
    expect(DEFAULT_POLL_INTERVAL_MS).toBe(60_000);
  });

  test('normalizes select values and falls back to the default interval', () => {
    expect(normalizePollIntervalMs('0')).toBe(0);
    expect(normalizePollIntervalMs('15000')).toBe(15_000);
    expect(normalizePollIntervalMs('60000')).toBe(60_000);
    expect(normalizePollIntervalMs('86400000')).toBe(86_400_000);
    expect(normalizePollIntervalMs('unexpected')).toBe(DEFAULT_POLL_INTERVAL_MS);
  });

  test('reports whether polling is enabled', () => {
    expect(isPollingEnabled('0')).toBe(false);
    expect(isPollingEnabled('30000')).toBe(true);
    expect(isPollingEnabled('unexpected')).toBe(true);
  });
});

describe('runs limit settings', () => {
  test('rounds up to the next hundred with a minimum of 100', () => {
    expect(normalizeRunsLimit('')).toBe(100);
    expect(normalizeRunsLimit('1')).toBe(100);
    expect(normalizeRunsLimit('100')).toBe(100);
    expect(normalizeRunsLimit('101')).toBe(200);
    expect(normalizeRunsLimit('250')).toBe(300);
  });
});
