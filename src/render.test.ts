import { describe, expect, test } from "bun:test";

import {
  compareRepos,
  countWorkflowRuns,
  groupRunsByWorkflow,
  repoSortRank,
  runView,
} from "./render";
import type { Repository } from "./types";

const repo = (
  fullName: string,
  options: Partial<Repository> = {}
): Repository => ({
  fork: false,
  full_name: fullName,
  html_url: `https://github.com/${fullName}`,
  owner: {
    avatar_url: "https://github.com/owner.png",
    login: fullName.split("/")[0] ?? "",
  },
  private: false,
  ...options,
});

describe("repoSortRank", () => {
  test("sorts public repos before private repos and forks", () => {
    expect(repoSortRank({ fork: false, private: false })).toBe(0);
    expect(repoSortRank({ fork: false, private: true })).toBe(1);
    expect(repoSortRank({ fork: true, private: false })).toBe(2);
    expect(repoSortRank({ fork: true, private: true })).toBe(2);
  });
});

describe("compareRepos", () => {
  test("puts contributor repos after owned repos", () => {
    const repos = [
      repo("contributor/public"),
      repo("owner/fork", { fork: true }),
      repo("owner/private", { private: true }),
      repo("owner/public"),
    ];

    expect(
      repos
        .toSorted((a, b) => compareRepos(a, b, "owner"))
        .map((item) => item.full_name)
    ).toEqual([
      "owner/public",
      "owner/private",
      "owner/fork",
      "contributor/public",
    ]);
  });

  test("keeps public, private, fork, owner, and name sorting inside contributor repos", () => {
    const repos = [
      repo("zeta/fork", { fork: true }),
      repo("beta/private", { private: true }),
      repo("zeta/public"),
      repo("alpha/z-last"),
      repo("alpha/a-first"),
    ];

    expect(
      repos
        .toSorted((a, b) => compareRepos(a, b, "owner"))
        .map((item) => item.full_name)
    ).toEqual([
      "alpha/a-first",
      "alpha/z-last",
      "zeta/public",
      "beta/private",
      "zeta/fork",
    ]);
  });
});

describe("runView", () => {
  test("maps current GitHub workflow statuses explicitly", () => {
    expect(runView(null)).toMatchObject({
      countKey: "other",
      label: "no runs",
      mod: "neutral",
    });
    expect(runView({ conclusion: null, status: "queued" })).toMatchObject({
      countKey: "queued",
      label: "queued",
      mod: "queued",
    });
    expect(runView({ conclusion: null, status: "requested" })).toMatchObject({
      countKey: "queued",
      label: "requested",
      mod: "queued",
    });
    expect(runView({ conclusion: null, status: "waiting" })).toMatchObject({
      countKey: "queued",
      label: "waiting",
      mod: "queued",
    });
    expect(runView({ conclusion: null, status: "pending" })).toMatchObject({
      countKey: "queued",
      label: "pending",
      mod: "queued",
    });
    expect(runView({ conclusion: null, status: "in_progress" })).toMatchObject({
      countKey: "running",
      label: "running",
      mod: "running",
    });
    expect(runView({ conclusion: null, status: "completed" })).toMatchObject({
      countKey: "other",
      label: "completed",
      mod: "neutral",
    });
  });

  test("maps current GitHub workflow conclusions explicitly", () => {
    expect(
      runView({ conclusion: "success", status: "completed" })
    ).toMatchObject({
      countKey: "pass",
      label: "success",
      mod: "success",
    });
    expect(
      runView({ conclusion: "failure", status: "completed" })
    ).toMatchObject({
      countKey: "fail",
      label: "failure",
      mod: "failure",
    });
    expect(
      runView({ conclusion: "action_required", status: "completed" })
    ).toMatchObject({
      countKey: "fail",
      label: "action_required",
      mod: "failure",
    });
    expect(
      runView({ conclusion: "timed_out", status: "completed" })
    ).toMatchObject({
      countKey: "fail",
      label: "timed_out",
      mod: "failure",
    });
    expect(
      runView({ conclusion: "cancelled", status: "completed" })
    ).toMatchObject({
      countKey: "other",
      label: "cancelled",
      mod: "neutral",
    });
    expect(
      runView({ conclusion: "neutral", status: "completed" })
    ).toMatchObject({
      countKey: "other",
      label: "neutral",
      mod: "neutral",
    });
    expect(
      runView({ conclusion: "skipped", status: "completed" })
    ).toMatchObject({
      countKey: "other",
      label: "skipped",
      mod: "neutral",
    });
    expect(runView({ conclusion: "stale", status: "completed" })).toMatchObject(
      {
        countKey: "other",
        label: "stale",
        mod: "neutral",
      }
    );
  });

  test("keeps unknown API values visible as neutral fallbacks", () => {
    expect(runView({ conclusion: null, status: "new_status" })).toMatchObject({
      countKey: "other",
      label: "new_status",
      mod: "neutral",
    });
    expect(
      runView({ conclusion: "new_conclusion", status: "completed" })
    ).toMatchObject({
      countKey: "other",
      label: "new_conclusion",
      mod: "neutral",
    });
  });
});

describe("groupRunsByWorkflow", () => {
  test("groups by workflow id and sorts newest runs first", () => {
    const grouped = groupRunsByWorkflow({
      a: { created_at: "2026-05-14T00:00:00Z", workflow_id: 1 },
      b: { created_at: "2026-05-14T00:01:00Z", workflow_id: 1 },
      c: { created_at: "2026-05-14T00:02:00Z", workflow_id: 2 },
    });

    expect(grouped.get(1)?.map((run) => run.created_at)).toEqual([
      "2026-05-14T00:01:00Z",
      "2026-05-14T00:00:00Z",
    ]);
    expect(grouped.get(2)).toEqual([
      { created_at: "2026-05-14T00:02:00Z", workflow_id: 2 },
    ]);
  });
});

describe("countWorkflowRuns", () => {
  test("counts pass, fail, running, queued, and other buckets consistently with runView", () => {
    const workflows = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 6 },
    ];
    const runsByWorkflow = new Map([
      [1, [{ conclusion: "success", status: "completed" }]],
      [
        2,
        [
          { conclusion: "failure", status: "completed" },
          { conclusion: "timed_out", status: "completed" },
        ],
      ],
      [3, [{ conclusion: null, status: "in_progress" }]],
      [
        4,
        [
          { conclusion: null, status: "queued" },
          { conclusion: null, status: "waiting" },
        ],
      ],
      [5, [{ conclusion: "skipped", status: "completed" }]],
    ]);

    expect(countWorkflowRuns(workflows, runsByWorkflow)).toEqual({
      fail: 2,
      other: 2,
      pass: 1,
      queued: 2,
      running: 1,
    });
  });
});
