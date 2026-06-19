import { describe, expect, test } from 'vitest';

import { countWorkflowRuns, groupRunsByWorkflow, repoSortRank, runView } from './render.js';

describe('repoSortRank', () => {
  test('sorts public repos before private repos and forks', () => {
    expect(repoSortRank({ private: false, fork: false })).toBe(0);
    expect(repoSortRank({ private: true, fork: false })).toBe(1);
    expect(repoSortRank({ private: false, fork: true })).toBe(2);
    expect(repoSortRank({ private: true, fork: true })).toBe(2);
  });
});

describe('runView', () => {
  test('maps current GitHub workflow statuses explicitly', () => {
    expect(runView(null)).toMatchObject({ mod: 'neutral', label: 'no runs', countKey: 'other' });
    expect(runView({ status: 'queued', conclusion: null })).toMatchObject({
      mod: 'queued',
      label: 'queued',
      countKey: 'queued',
    });
    expect(runView({ status: 'requested', conclusion: null })).toMatchObject({
      mod: 'queued',
      label: 'requested',
      countKey: 'queued',
    });
    expect(runView({ status: 'waiting', conclusion: null })).toMatchObject({
      mod: 'queued',
      label: 'waiting',
      countKey: 'queued',
    });
    expect(runView({ status: 'pending', conclusion: null })).toMatchObject({
      mod: 'queued',
      label: 'pending',
      countKey: 'queued',
    });
    expect(runView({ status: 'in_progress', conclusion: null })).toMatchObject({
      mod: 'running',
      label: 'running',
      countKey: 'running',
    });
    expect(runView({ status: 'completed', conclusion: null })).toMatchObject({
      mod: 'neutral',
      label: 'completed',
      countKey: 'other',
    });
  });

  test('maps current GitHub workflow conclusions explicitly', () => {
    expect(runView({ status: 'completed', conclusion: 'success' })).toMatchObject({
      mod: 'success',
      label: 'success',
      countKey: 'pass',
    });
    expect(runView({ status: 'completed', conclusion: 'failure' })).toMatchObject({
      mod: 'failure',
      label: 'failure',
      countKey: 'fail',
    });
    expect(runView({ status: 'completed', conclusion: 'action_required' })).toMatchObject({
      mod: 'failure',
      label: 'action_required',
      countKey: 'fail',
    });
    expect(runView({ status: 'completed', conclusion: 'timed_out' })).toMatchObject({
      mod: 'failure',
      label: 'timed_out',
      countKey: 'fail',
    });
    expect(runView({ status: 'completed', conclusion: 'cancelled' })).toMatchObject({
      mod: 'neutral',
      label: 'cancelled',
      countKey: 'other',
    });
    expect(runView({ status: 'completed', conclusion: 'neutral' })).toMatchObject({
      mod: 'neutral',
      label: 'neutral',
      countKey: 'other',
    });
    expect(runView({ status: 'completed', conclusion: 'skipped' })).toMatchObject({
      mod: 'neutral',
      label: 'skipped',
      countKey: 'other',
    });
    expect(runView({ status: 'completed', conclusion: 'stale' })).toMatchObject({
      mod: 'neutral',
      label: 'stale',
      countKey: 'other',
    });
  });

  test('keeps unknown API values visible as neutral fallbacks', () => {
    expect(runView({ status: 'new_status', conclusion: null })).toMatchObject({
      mod: 'neutral',
      label: 'new_status',
      countKey: 'other',
    });
    expect(runView({ status: 'completed', conclusion: 'new_conclusion' })).toMatchObject({
      mod: 'neutral',
      label: 'new_conclusion',
      countKey: 'other',
    });
  });
});

describe('groupRunsByWorkflow', () => {
  test('groups by workflow id and sorts newest runs first', () => {
    const grouped = groupRunsByWorkflow({
      a: { workflow_id: 1, created_at: '2026-05-14T00:00:00Z' },
      b: { workflow_id: 1, created_at: '2026-05-14T00:01:00Z' },
      c: { workflow_id: 2, created_at: '2026-05-14T00:02:00Z' },
    });

    expect(grouped.get(1).map(run => run.created_at)).toEqual([
      '2026-05-14T00:01:00Z',
      '2026-05-14T00:00:00Z',
    ]);
    expect(grouped.get(2)).toEqual([{ workflow_id: 2, created_at: '2026-05-14T00:02:00Z' }]);
  });
});

describe('countWorkflowRuns', () => {
  test('counts pass, fail, running, queued, and other buckets consistently with runView', () => {
    const workflows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }];
    const runsByWorkflow = new Map([
      [1, [{ status: 'completed', conclusion: 'success' }]],
      [
        2,
        [
          { status: 'completed', conclusion: 'failure' },
          { status: 'completed', conclusion: 'timed_out' },
        ],
      ],
      [3, [{ status: 'in_progress', conclusion: null }]],
      [
        4,
        [
          { status: 'queued', conclusion: null },
          { status: 'waiting', conclusion: null },
        ],
      ],
      [5, [{ status: 'completed', conclusion: 'skipped' }]],
    ]);

    expect(countWorkflowRuns(workflows, runsByWorkflow)).toEqual({
      pass: 1,
      fail: 2,
      running: 1,
      queued: 2,
      other: 2,
    });
  });
});
