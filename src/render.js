import { timeAgo } from './cache.js';

const $ = id => document.getElementById(id);

function badge(run) {
  if (!run) return `<span class="badge badge-neutral">no runs</span>`;
  if (run.status === 'in_progress') return `<span class="badge badge-running">running</span>`;
  if (run.conclusion === 'success') return `<span class="badge badge-success">success</span>`;
  if (run.conclusion === 'failure') return `<span class="badge badge-failure">failure</span>`;
  return `<span class="badge badge-neutral">${run.conclusion || run.status}</span>`;
}

function stateIcon(state) {
  return state === 'active'
    ? `<span class="dot-active">●</span>`
    : `<span class="dot-disabled">○</span>`;
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

function renderWorkflow(wf, run) {
  return `
    <div class="wf-row">
      <div class="wf-left">
        <a href="${wf.html_url}" target="_blank" class="wf-name">${wf.name}</a>
        <div class="wf-meta">
          ${stateIcon(wf.state)}
          <span>${wf.path}</span>
        </div>
      </div>
      <div class="wf-right">
        ${badge(run)}
        <span class="run-time">${timeStr(run)}</span>
        <a href="${run?.html_url || wf.html_url}" target="_blank" class="wf-link">
          <i class="fa-solid fa-arrow-up-right-from-square"></i>
        </a>
      </div>
    </div>`;
}

function renderRepo(repo, workflows, latestRuns) {
  let pass = 0,
    fail = 0,
    other = 0;
  for (const wf of workflows) {
    const run = latestRuns[wf.id];
    if (!run) {
      other++;
      continue;
    }
    if (run.conclusion === 'success') pass++;
    else if (run.conclusion === 'failure') fail++;
    else other++;
  }

  const tally = [
    pass ? `<span class="t-pass">✓ ${pass}</span>` : '',
    fail ? `<span class="t-fail">✗ ${fail}</span>` : '',
    other ? `<span class="t-other">? ${other}</span>` : '',
  ]
    .filter(Boolean)
    .join('');

  return `
    <div class="repo" onclick="this.classList.toggle('open'); this.querySelector('.repo-body').classList.toggle('hidden')">
      <div class="repo-header">
        <div class="repo-info">
          <img src="${repo.owner.avatar_url}" alt="">
          <a href="${repo.html_url}" target="_blank" onclick="event.stopPropagation()">${repo.full_name}</a>
          <span class="wf-count">${workflows.length}</span>
          <span class="repo-tally">${tally}</span>
        </div>
        <span class="chevron"><i class="fa-solid fa-chevron-down"></i></span>
      </div>
      <div class="repo-body hidden" onclick="event.stopPropagation()">
        ${workflows.map(wf => renderWorkflow(wf, latestRuns[wf.id])).join('')}
      </div>
    </div>`;
}

export function renderResults(results, ts) {
  const totalWf = results.reduce((n, r) => n + r.workflows.length, 0);
  const age = ts ? `<span class="cache-age">updated ${timeAgo(ts)}</span>` : '';

  $('stats').innerHTML =
    `<strong>${results.length}</strong> repositories · <strong>${totalWf}</strong> workflows${age}`;
  $('repos').innerHTML = results.map(r => renderRepo(r.repo, r.workflows, r.latestRuns)).join('');
  $('content').classList.remove('hidden');

  if (!results.length) $('empty').classList.remove('hidden');
}
