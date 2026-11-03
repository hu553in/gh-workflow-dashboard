import { element as $ } from "./dom";
import type { RepoResult, Repository, Workflow, WorkflowRun } from "./types";

type RunState = Pick<WorkflowRun, "status" | "conclusion">;
interface RunView {
  mod: string;
  label: string;
  iconClass: string;
  countKey: "pass" | "fail" | "running" | "queued" | "other";
}

export function icon(className: string) {
  const el = document.createElement("i");
  el.className = className;
  return el;
}

function link(url: string, className: string, text?: string) {
  const el = document.createElement("a");
  el.href = url;
  el.target = "_blank";
  el.rel = "noopener noreferrer";
  if (className) {
    el.className = className;
  }
  if (text) {
    el.textContent = text;
  }
  return el;
}

export function setButtonLabel(
  buttonId: string,
  iconClass: string,
  label: string
) {
  $(buttonId).replaceChildren(icon(iconClass), document.createTextNode(label));
}

function setToggleAllButton(isAllOpen: boolean) {
  setButtonLabel(
    "toggle-all",
    isAllOpen ? "fa-solid fa-angles-up" : "fa-solid fa-angles-down",
    isAllOpen ? "Collapse all" : "Expand all"
  );
}

function updateToggleAllButton() {
  const repos = [...document.querySelectorAll(".repo")];
  const isAllOpen =
    repos.length > 0 && repos.every((repo) => repo.classList.contains("open"));
  setToggleAllButton(isAllOpen);
}

export function repoSortRank(repo: Pick<Repository, "private" | "fork">) {
  if (repo.fork) {
    return 2;
  }
  if (repo.private) {
    return 1;
  }
  return 0;
}

export function compareRepos(
  a: Repository,
  b: Repository,
  authenticatedUserLogin: string | null
) {
  const ownershipCompare =
    Number(a.owner.login !== authenticatedUserLogin) -
    Number(b.owner.login !== authenticatedUserLogin);
  if (ownershipCompare !== 0) {
    return ownershipCompare;
  }

  const rankCompare = repoSortRank(a) - repoSortRank(b);
  if (rankCompare !== 0) {
    return rankCompare;
  }

  const ownerCompare = a.owner.login.localeCompare(b.owner.login);
  if (ownerCompare !== 0) {
    return ownerCompare;
  }

  return a.full_name.localeCompare(b.full_name);
}

const runViews = {
  actionRequired: {
    countKey: "fail",
    iconClass: "fa-solid fa-triangle-exclamation",
    label: "action_required",
    mod: "failure",
  },
  cancelled: {
    countKey: "other",
    iconClass: "fa-solid fa-ban",
    label: "cancelled",
    mod: "neutral",
  },
  completed: {
    countKey: "other",
    iconClass: "fa-regular fa-circle-check",
    label: "completed",
    mod: "neutral",
  },
  failure: {
    countKey: "fail",
    iconClass: "fa-solid fa-xmark",
    label: "failure",
    mod: "failure",
  },
  neutral: {
    countKey: "other",
    iconClass: "fa-solid fa-minus",
    label: "neutral",
    mod: "neutral",
  },
  none: {
    countKey: "other",
    iconClass: "fa-regular fa-circle",
    label: "no runs",
    mod: "neutral",
  },
  other: {
    countKey: "other",
    iconClass: "fa-regular fa-circle-question",
    label: "other",
    mod: "neutral",
  },
  queued: {
    countKey: "queued",
    iconClass: "fa-regular fa-clock",
    label: "queued",
    mod: "queued",
  },
  running: {
    countKey: "running",
    iconClass: "fa-solid fa-circle-notch fa-spin",
    label: "running",
    mod: "running",
  },
  skipped: {
    countKey: "other",
    iconClass: "fa-solid fa-forward",
    label: "skipped",
    mod: "neutral",
  },
  stale: {
    countKey: "other",
    iconClass: "fa-solid fa-clock-rotate-left",
    label: "stale",
    mod: "neutral",
  },
  success: {
    countKey: "pass",
    iconClass: "fa-solid fa-check",
    label: "success",
    mod: "success",
  },
  timedOut: {
    countKey: "fail",
    iconClass: "fa-solid fa-hourglass-half",
    label: "timed_out",
    mod: "failure",
  },
} satisfies Record<string, RunView>;

const statusViews: Record<string, RunView> = {
  completed: runViews.completed,
  in_progress: runViews.running,
  pending: { ...runViews.queued, label: "pending" },
  queued: runViews.queued,
  requested: { ...runViews.queued, label: "requested" },
  waiting: { ...runViews.queued, label: "waiting" },
};

const conclusionViews: Record<string, RunView> = {
  action_required: runViews.actionRequired,
  cancelled: runViews.cancelled,
  failure: runViews.failure,
  neutral: runViews.neutral,
  skipped: runViews.skipped,
  stale: runViews.stale,
  success: runViews.success,
  timed_out: runViews.timedOut,
};

export function runView(run: RunState | null): RunView {
  if (!run) {
    return runViews.none;
  }
  const conclusionView = run.conclusion
    ? conclusionViews[run.conclusion]
    : undefined;
  if (conclusionView) {
    return conclusionView;
  }
  if (run.conclusion) {
    return {
      ...runViews.other,
      label: run.conclusion,
    };
  }
  const statusView = statusViews[run.status];
  if (statusView) {
    return statusView;
  }

  return {
    ...runViews.other,
    label: run.status || runViews.other.label,
  };
}

function badge(run: WorkflowRun | null) {
  const el = document.createElement("span");
  const view = runView(run);
  const label = document.createElement("span");

  label.className = "badge-label";
  label.textContent = view.label;
  el.classList.add("badge", `badge-${view.mod}`);
  el.append(icon(view.iconClass), label);
  return el;
}

function stateIcon(state: string) {
  const el = document.createElement("span");
  const active = state === "active";
  el.className = active ? "dot-active" : "dot-disabled";
  el.textContent = active ? "●" : "○";
  return el;
}

function timeStr(run: WorkflowRun | null) {
  if (!run) {
    return "-";
  }
  return new Date(run.created_at).toLocaleString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  });
}

export function groupRunsByWorkflow<
  T extends Pick<WorkflowRun, "workflow_id" | "created_at">,
>(latestRuns: Record<string, T>) {
  const runsByWorkflow = new Map<number, T[]>();

  for (const run of Object.values(latestRuns)) {
    const runs = runsByWorkflow.get(run.workflow_id) ?? [];
    runs.push(run);
    runsByWorkflow.set(run.workflow_id, runs);
  }

  for (const runs of runsByWorkflow.values()) {
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return runsByWorkflow;
}

export function countWorkflowRuns(
  workflows: Pick<Workflow, "id">[],
  runsByWorkflow: Map<number, RunState[]>
) {
  const counts = {
    fail: 0,
    other: 0,
    pass: 0,
    queued: 0,
    running: 0,
  };

  for (const wf of workflows) {
    const runs = runsByWorkflow.get(wf.id) ?? [];
    if (!runs.length) {
      counts.other += 1;
      continue;
    }

    for (const run of runs) {
      counts[runView(run).countKey] += 1;
    }
  }

  return counts;
}

function renderRunRow(run: WorkflowRun | null) {
  const row = document.createElement("div");
  row.className = "run-row";

  const source = document.createElement("span");
  source.className = "wf-source";
  source.textContent = run ? `${run.event} • ${run.head_branch}` : "-";

  const right = document.createElement("div");
  right.className = "run-right";
  right.append(badge(run));

  if (run) {
    const time = document.createElement("span");
    time.className = "run-time";
    time.textContent = timeStr(run);
    right.append(time);

    const runLink = link(run.html_url, "wf-link hover-accent");
    runLink.append(icon("fa-solid fa-arrow-up-right-from-square"));
    right.append(runLink);
  }

  row.append(source, right);
  return row;
}

function renderWorkflowGroup(
  wf: Workflow,
  runsByWorkflow: Map<number, WorkflowRun[]>
) {
  const group = document.createElement("div");
  group.className = "wf-group";

  const header = document.createElement("div");
  header.className = "wf-header";

  const name = link(wf.html_url, "wf-name hover-accent", wf.name);
  const meta = document.createElement("div");
  meta.className = "wf-meta";

  const path = document.createElement("span");
  path.textContent = wf.path;
  meta.append(stateIcon(wf.state), path);

  header.append(name, meta);

  const runs = runsByWorkflow.get(wf.id) ?? [];
  const runsEl = document.createElement("div");
  runsEl.className = "wf-runs";

  for (const run of runs) {
    runsEl.append(renderRunRow(run));
  }
  if (!runs.length) {
    runsEl.append(renderRunRow(null));
  }

  group.append(header, runsEl);
  return group;
}

function renderRepo(
  repo: Repository,
  workflows: Workflow[],
  latestRuns: Record<string, WorkflowRun>
) {
  const runsByWorkflow = groupRunsByWorkflow(latestRuns);
  const counts = countWorkflowRuns(workflows, runsByWorkflow);

  const repoEl = document.createElement("div");
  repoEl.className = "repo";

  const body = document.createElement("div");
  body.className = "repo-body hidden";

  const header = document.createElement("div");
  header.className = "repo-header";
  header.addEventListener("click", () => {
    repoEl.classList.toggle("open");
    body.classList.toggle("hidden");
    updateToggleAllButton();
  });

  const info = document.createElement("div");
  info.className = "repo-info";

  const avatar = document.createElement("img");
  avatar.src = repo.owner.avatar_url;
  avatar.alt = `${repo.owner.login} avatar`;
  avatar.loading = "lazy";
  avatar.addEventListener(
    "error",
    () => {
      avatar.src =
        "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";
    },
    { once: true }
  );

  const repoLink = link(repo.html_url, "hover-accent", repo.full_name);
  repoLink.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  info.append(avatar);

  if (repo.private) {
    const privateIcon = icon("fa-solid fa-lock");
    privateIcon.classList.add("repo-meta-icon");
    privateIcon.setAttribute("aria-label", "Private repository");
    info.append(privateIcon);
  }

  if (repo.fork) {
    const forkIcon = icon("fa-solid fa-code-fork");
    forkIcon.classList.add("repo-meta-icon");
    forkIcon.setAttribute("aria-label", "Fork");
    info.append(forkIcon);
  }

  info.append(repoLink);

  const wfCount = document.createElement("span");
  wfCount.className = "wf-count";
  wfCount.textContent = String(workflows.length);

  const tally = document.createElement("span");
  tally.className = "repo-tally";

  for (const [cls, view, count] of [
    ["t-pass", runViews.success, counts.pass],
    ["t-fail", runViews.failure, counts.fail],
    ["t-running", runViews.running, counts.running],
    ["t-queued", runViews.queued, counts.queued],
    ["t-other", runViews.other, counts.other],
  ] as const) {
    if (!count) {
      continue;
    }
    const el = document.createElement("span");
    el.className = cls;
    el.append(
      icon(view.iconClass),
      document.createTextNode(` ${String(count)}`)
    );
    tally.append(el);
  }
  info.append(wfCount, tally);

  const chevron = document.createElement("span");
  chevron.className = "chevron";
  chevron.append(icon("fa-solid fa-chevron-down"));

  header.append(info, chevron);

  for (const wf of workflows) {
    body.append(renderWorkflowGroup(wf, runsByWorkflow));
  }

  repoEl.append(header, body);
  return repoEl;
}

export function renderResults(
  results: RepoResult[],
  authenticatedUserLogin: string | null
) {
  const sortedResults = results.toSorted((a, b) =>
    compareRepos(a.repo, b.repo, authenticatedUserLogin)
  );

  const totalWf = sortedResults.reduce((n, r) => n + r.workflows.length, 0);

  const stats = $("stats");
  stats.replaceChildren();

  const repoCount = document.createElement("strong");
  repoCount.textContent = String(results.length);

  const wfCount = document.createElement("strong");
  wfCount.textContent = String(totalWf);

  stats.append(repoCount, " repositories • ", wfCount, " workflows");

  $("repos").replaceChildren(
    ...sortedResults.map((r) => renderRepo(r.repo, r.workflows, r.latestRuns))
  );
  $("content").classList.remove("hidden");
  $("empty").classList.toggle("hidden", sortedResults.length > 0);
  updateToggleAllButton();
}
