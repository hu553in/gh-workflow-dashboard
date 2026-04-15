const $ = id => document.getElementById(id);

export function icon(className) {
  const el = document.createElement('i');
  el.className = className;
  return el;
}

function link(url, className, text) {
  const el = document.createElement('a');
  el.href = url;
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function setToggleAllButton(isAllOpen) {
  const button = $('toggle-all');
  button.replaceChildren(
    icon(isAllOpen ? 'fa-solid fa-angles-up' : 'fa-solid fa-angles-down'),
    document.createTextNode(isAllOpen ? ' Collapse all' : ' Expand all')
  );
}

function updateToggleAllButton() {
  const repos = [...document.querySelectorAll('.repo')];
  const isAllOpen = repos.length > 0 && repos.every(repo => repo.classList.contains('open'));
  setToggleAllButton(isAllOpen);
}

function repoSortRank(repo) {
  if (repo.fork) return 2;
  if (repo.private) return 1;
  return 0;
}

function badge(run) {
  const el = document.createElement('span');
  el.classList.add('badge');

  let mod = 'neutral';
  let text = 'no runs';

  if (run) {
    if (run.status === 'in_progress') {
      mod = 'running';
      text = 'running';
    } else if (run.conclusion === 'success') {
      mod = 'success';
      text = 'success';
    } else if (run.conclusion === 'failure') {
      mod = 'failure';
      text = 'failure';
    } else {
      text = run.conclusion || run.status;
    }
  }

  el.classList.add(`badge-${mod}`);
  el.textContent = text;
  return el;
}

function stateIcon(state) {
  const el = document.createElement('span');
  const active = state === 'active';
  el.className = active ? 'dot-active' : 'dot-disabled';
  el.textContent = active ? '●' : '○';
  return el;
}

function timeStr(run) {
  if (!run) return '—';
  return new Date(run.created_at).toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function groupRunsByWorkflow(latestRuns) {
  const runsByWorkflow = new Map();

  for (const run of Object.values(latestRuns)) {
    if (!runsByWorkflow.has(run.workflow_id)) {
      runsByWorkflow.set(run.workflow_id, []);
    }
    runsByWorkflow.get(run.workflow_id).push(run);
  }

  for (const runs of runsByWorkflow.values()) {
    runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  return runsByWorkflow;
}

function renderRunRow(run) {
  const row = document.createElement('div');
  row.className = 'run-row';

  const source = document.createElement('span');
  source.className = 'wf-source';
  source.textContent = run ? `${run.event} · ${run.head_branch}` : '—';

  const right = document.createElement('div');
  right.className = 'run-right';
  right.append(badge(run));

  if (run) {
    const time = document.createElement('span');
    time.className = 'run-time';
    time.textContent = timeStr(run);
    right.append(time);

    const runLink = link(run.html_url, 'wf-link hover-accent');
    runLink.append(icon('fa-solid fa-arrow-up-right-from-square'));
    right.append(runLink);
  }

  row.append(source, right);
  return row;
}

function renderWorkflowGroup(wf, runsByWorkflow) {
  const group = document.createElement('div');
  group.className = 'wf-group';

  const header = document.createElement('div');
  header.className = 'wf-header';

  const name = link(wf.html_url, 'wf-name hover-accent', wf.name);
  const meta = document.createElement('div');
  meta.className = 'wf-meta';

  const path = document.createElement('span');
  path.textContent = wf.path;
  meta.append(stateIcon(wf.state), path);

  header.append(name, meta);

  const runs = runsByWorkflow.get(wf.id) || [];
  const runsEl = document.createElement('div');
  runsEl.className = 'wf-runs';

  for (const run of runs) runsEl.append(renderRunRow(run));
  if (!runs.length) runsEl.append(renderRunRow(null));

  group.append(header, runsEl);
  return group;
}

function renderRepo(repo, workflows, latestRuns) {
  const runsByWorkflow = groupRunsByWorkflow(latestRuns);
  let pass = 0;
  let fail = 0;
  let other = 0;

  for (const wf of workflows) {
    const runs = runsByWorkflow.get(wf.id) || [];
    if (!runs.length) {
      other++;
      continue;
    }

    for (const run of runs) {
      if (run.conclusion === 'success') pass++;
      else if (run.conclusion === 'failure') fail++;
      else other++;
    }
  }

  const repoEl = document.createElement('div');
  repoEl.className = 'repo';

  const header = document.createElement('div');
  header.className = 'repo-header';
  header.addEventListener('click', () => {
    repoEl.classList.toggle('open');
    body.classList.toggle('hidden');
    updateToggleAllButton();
  });

  const info = document.createElement('div');
  info.className = 'repo-info';

  const avatar = document.createElement('img');
  avatar.src = repo.owner.avatar_url;
  avatar.alt = `${repo.owner.login} avatar`;

  const repoLink = link(repo.html_url, 'hover-accent', repo.full_name);
  repoLink.addEventListener('click', e => e.stopPropagation());

  info.append(avatar);

  if (repo.private) {
    const privateIcon = icon('fa-solid fa-lock');
    privateIcon.classList.add('repo-meta-icon');
    privateIcon.setAttribute('aria-label', 'Private repository');
    info.append(privateIcon);
  }

  if (repo.fork) {
    const forkIcon = icon('fa-solid fa-code-fork');
    forkIcon.classList.add('repo-meta-icon');
    forkIcon.setAttribute('aria-label', 'Fork');
    info.append(forkIcon);
  }

  info.append(repoLink);

  const wfCount = document.createElement('span');
  wfCount.className = 'wf-count';
  wfCount.textContent = workflows.length;

  const tally = document.createElement('span');
  tally.className = 'repo-tally';

  for (const [cls, symbol, count] of [
    ['t-pass', '✓', pass],
    ['t-fail', '✗', fail],
    ['t-other', '?', other],
  ]) {
    if (!count) continue;
    const el = document.createElement('span');
    el.className = cls;
    el.textContent = `${symbol} ${count}`;
    tally.append(el);
  }
  info.append(wfCount, tally);

  const chevron = document.createElement('span');
  chevron.className = 'chevron';
  chevron.append(icon('fa-solid fa-chevron-down'));

  header.append(info, chevron);

  const body = document.createElement('div');
  body.className = 'repo-body hidden';

  for (const wf of workflows) body.append(renderWorkflowGroup(wf, runsByWorkflow));

  repoEl.append(header, body);
  return repoEl;
}

export function renderResults(results) {
  const sortedResults = [...results].sort((a, b) => {
    const ownerCompare = a.repo.owner.login.localeCompare(b.repo.owner.login);
    if (ownerCompare !== 0) return ownerCompare;
    const rankCompare = repoSortRank(a.repo) - repoSortRank(b.repo);
    if (rankCompare !== 0) return rankCompare;
    return a.repo.full_name.localeCompare(b.repo.full_name);
  });

  const totalWf = sortedResults.reduce((n, r) => n + r.workflows.length, 0);

  const stats = $('stats');
  stats.replaceChildren();

  const repoCount = document.createElement('strong');
  repoCount.textContent = results.length;

  const wfCount = document.createElement('strong');
  wfCount.textContent = totalWf;

  stats.append(repoCount, ' repositories · ', wfCount, ' workflows');

  $('repos').replaceChildren(
    ...sortedResults.map(r => renderRepo(r.repo, r.workflows, r.latestRuns))
  );
  $('content').classList.remove('hidden');
  $('empty').classList.toggle('hidden', sortedResults.length > 0);
  updateToggleAllButton();
}
