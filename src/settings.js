export const POLL_INTERVAL_OPTIONS = [
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
];

export const DEFAULT_POLL_INTERVAL_MS = 60_000;

const pollIntervalsByValue = new Map(
  POLL_INTERVAL_OPTIONS.map(option => [option.value, option.ms])
);

export function normalizePollIntervalMs(value) {
  const key = String(value);
  return pollIntervalsByValue.has(key) ? pollIntervalsByValue.get(key) : DEFAULT_POLL_INTERVAL_MS;
}

export function isPollingEnabled(value) {
  return normalizePollIntervalMs(value) > 0;
}

export function normalizeRunsLimit(value) {
  const parsedValue = Number.parseInt(value, 10);
  return Number.isFinite(parsedValue) ? Math.max(100, Math.ceil(parsedValue / 100) * 100) : 100;
}
