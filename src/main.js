import './style.css';

import { api, getToken, paginate, pool, setToken } from './api.js';
import { appendRef, resolveRunRefType } from './refs.js';
import { icon, renderResults, setButtonLabel } from './render.js';
import {
  DEFAULT_POLL_INTERVAL_MS,
  isPollingEnabled,
  normalizePollIntervalMs,
  normalizeRunsLimit,
  POLL_INTERVAL_OPTIONS,
} from './settings.js';

const $ = id => document.getElementById(id);
let isLoading = false;
let hasLoadedResults = false;
let pollTimerId = null;

function setTokenStatus(message = '', state = 'success') {
  const container = $('token-status-container');
  const trigger = $('token-status');
  const popover = $('token-status-help');

  trigger.replaceChildren();
  popover.textContent = '';
  trigger.classList.remove('status-success', 'status-error');
  trigger.setAttribute('aria-expanded', 'false');

  if (!message) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  trigger.classList.add(state === 'success' ? 'status-success' : 'status-error');
  trigger.append(icon(state === 'success' ? 'fa-solid fa-check' : 'fa-solid fa-xmark'));
  popover.textContent = message;
}

function setLoadingState(nextIsLoading) {
  isLoading = nextIsLoading;
  $('btn-load').disabled = nextIsLoading;
  setButtonLabel(
    'btn-load',
    nextIsLoading ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-right',
    'Load'
  );
  $('btn-clear').disabled = nextIsLoading;
  $('btn-toggle-token').disabled = nextIsLoading;
  $('toggle-all').disabled = nextIsLoading;
  $('token').readOnly = nextIsLoading;
  $('runs-limit').disabled = nextIsLoading;
  $('poll-interval').disabled = nextIsLoading;
}

function clearResultsView() {
  $('repos').replaceChildren();
  $('stats').textContent = '';
  $('content').classList.add('hidden');
  $('empty').classList.add('hidden');
  setButtonLabel('toggle-all', 'fa-solid fa-angles-down', 'Expand all');
}

function resetResultsView() {
  setLoadingState(false);
  hasLoadedResults = false;
  clearPollTimer();
  clearResultsView();
}

function closeHelp(trigger) {
  trigger.setAttribute('aria-expanded', 'false');
}

function closeAllHelp(exceptTrigger = null) {
  document.querySelectorAll('[data-help-trigger][aria-expanded="true"]').forEach(trigger => {
    if (trigger !== exceptTrigger) closeHelp(trigger);
  });
}

function toggleHelp(trigger) {
  const shouldOpen = trigger.getAttribute('aria-expanded') !== 'true';
  closeAllHelp(trigger);
  trigger.setAttribute('aria-expanded', String(shouldOpen));
}

function setTokenVisibility(isVisible) {
  const button = $('btn-toggle-token');
  $('token').type = isVisible ? 'text' : 'password';
  button.setAttribute('aria-label', isVisible ? 'Hide token' : 'Show token');
  button.setAttribute('aria-pressed', String(isVisible));
  button.title = isVisible ? 'Hide token' : 'Show token';
  button.replaceChildren(icon(isVisible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'));
}

function getRunsLimit() {
  const input = $('runs-limit');
  const normalizedValue = normalizeRunsLimit(input.value);

  input.value = normalizedValue;
  return normalizedValue;
}

function getPollIntervalMs() {
  return normalizePollIntervalMs($('poll-interval').value);
}

function clearPollTimer() {
  if (!pollTimerId) return;
  clearTimeout(pollTimerId);
  pollTimerId = null;
}

function shouldSchedulePoll() {
  return (
    hasLoadedResults &&
    !isLoading &&
    getToken() &&
    isPollingEnabled($('poll-interval').value) &&
    !document.hidden
  );
}

function scheduleNextPoll() {
  clearPollTimer();
  if (!shouldSchedulePoll()) return;

  pollTimerId = setTimeout(() => {
    pollTimerId = null;
    loadData(false, { showErrors: false });
  }, getPollIntervalMs());
}

function renderPollIntervalOptions() {
  $('poll-interval').replaceChildren(
    ...POLL_INTERVAL_OPTIONS.map(option => {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = option.label;
      el.selected = option.ms === DEFAULT_POLL_INTERVAL_MS;
      return el;
    })
  );
}

async function validateToken(token) {
  await api('/user', token);
}

async function loadLiveRefs(fullName) {
  try {
    const [branches, tags] = await Promise.all([
      paginate(`/repos/${fullName}/branches`),
      paginate(`/repos/${fullName}/tags`),
    ]);

    const branchShasByName = new Map();
    const tagShasByName = new Map();

    for (const branch of branches) {
      appendRef(branchShasByName, branch.name, branch.commit?.sha);
    }

    for (const tag of tags) {
      appendRef(tagShasByName, tag.name, tag.commit?.sha);
    }

    return {
      names: new Set([...branchShasByName.keys(), ...tagShasByName.keys()]),
      branchShasByName,
      tagShasByName,
    };
  } catch {
    return null;
  }
}

async function fetchAll() {
  const runsLimit = getRunsLimit();
  const repos = await paginate('/user/repos?sort=full_name');

  const tasks = repos.map(repo => async () => {
    try {
      const { workflows = [] } = await api(`/repos/${repo.full_name}/actions/workflows`);
      if (!workflows.length) return null;

      const latestRuns = {};
      try {
        const liveRefsCache = new Map();
        const getLiveRefs = async fullName => {
          if (!liveRefsCache.has(fullName)) {
            liveRefsCache.set(fullName, loadLiveRefs(fullName));
          }

          return liveRefsCache.get(fullName);
        };

        const workflowRuns = await paginate(
          `/repos/${repo.full_name}/actions/runs`,
          data => data.workflow_runs ?? [],
          undefined,
          runsLimit
        );

        for (const run of workflowRuns) {
          const headRepoFullName = run.head_repository?.full_name || repo.full_name;
          const liveRefs = await getLiveRefs(headRepoFullName);
          if (liveRefs && !liveRefs.names.has(run.head_branch)) continue;

          const refType = resolveRunRefType(run, liveRefs);
          const key = `${run.workflow_id}:${headRepoFullName}:${refType}:${run.head_branch}`;
          const prev = latestRuns[key];
          if (!prev || run.created_at > prev.created_at) latestRuns[key] = run;
        }
      } catch {
        // ignore
      }

      return { repo, workflows, latestRuns };
    } catch {
      return null;
    }
  });

  return (await pool(tasks)).filter(Boolean);
}

async function loadData(force = false, { showErrors = true } = {}) {
  if (isLoading && !force) return;
  if (!getToken()) {
    if (showErrors) alert('Enter a GitHub token first.');
    return;
  }

  clearPollTimer();
  setLoadingState(true);

  try {
    const results = await fetchAll();
    clearResultsView();
    renderResults(results);
    hasLoadedResults = true;
  } catch (e) {
    console.error(e);
    if (showErrors) {
      alert('Error: ' + e.message);
    } else {
      setTokenStatus(e.message, 'error');
    }
  } finally {
    setLoadingState(false);
    scheduleNextPoll();
  }
}

async function validateAndLoad() {
  if (isLoading) return;
  const val = $('token').value.trim();
  if (!val) return alert('Enter a GitHub token first.');
  clearPollTimer();
  setLoadingState(true);

  try {
    await validateToken(val);
    setToken(val);
    localStorage.setItem('github_token', val);
    setTokenStatus('Token was accepted by GitHub.');
    await loadData(true);
  } catch (e) {
    setTokenStatus(e.message, 'error');
    setLoadingState(false);
  }
}

function toggleAll() {
  const repos = document.querySelectorAll('.repo');
  const allOpen = [...repos].every(r => r.classList.contains('open'));

  repos.forEach(r => {
    r.classList.toggle('open', !allOpen);
    r.querySelector('.repo-body').classList.toggle('hidden', allOpen);
  });

  setButtonLabel(
    'toggle-all',
    allOpen ? 'fa-solid fa-angles-down' : 'fa-solid fa-angles-up',
    allOpen ? 'Expand all' : 'Collapse all'
  );
}

function handleClear() {
  if (!confirm('Clear saved token?')) return;
  localStorage.removeItem('github_token');
  setToken('');
  $('token').value = '';
  setTokenVisibility(false);
  setTokenStatus();
  resetResultsView();
}

renderPollIntervalOptions();

$('btn-load').addEventListener('click', validateAndLoad);
$('btn-clear').addEventListener('click', handleClear);
$('btn-toggle-token').addEventListener('click', () => {
  setTokenVisibility($('token').type === 'password');
});
document.querySelectorAll('[data-help-trigger]').forEach(trigger => {
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    toggleHelp(trigger);
  });
});
$('poll-interval').addEventListener('change', scheduleNextPoll);
$('toggle-all').addEventListener('click', toggleAll);

document.addEventListener('visibilitychange', scheduleNextPoll);
document.addEventListener('click', e => {
  if (!e.target.closest('.help-container')) closeAllHelp();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllHelp();
});

$('token').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !isLoading) validateAndLoad();
});

const savedToken = localStorage.getItem('github_token') || '';
if (savedToken) {
  setToken(savedToken);
  $('token').value = savedToken;
  setTokenStatus('Token is loaded from storage.');
}
