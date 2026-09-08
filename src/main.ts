import '@fortawesome/fontawesome-free/js/all.js';
import './style.css';

import { api, getToken, paginate, pool, setToken } from './api';
import { button, element as $, input, select } from './dom';
import type { LiveRefs } from './refs';
import { appendRef, resolveRunRefType } from './refs';
import { icon, renderResults, setButtonLabel } from './render';
import {
  DEFAULT_POLL_INTERVAL_MS,
  isPollingEnabled,
  normalizePollIntervalMs,
  normalizeRunsLimit,
  POLL_INTERVAL_OPTIONS,
} from './settings';
import type { GitRef, Repository, Workflow, WorkflowRun } from './types';

let isLoading = false;
let hasLoadedResults = false;
let pollTimerId: ReturnType<typeof setTimeout> | null = null;
let authenticatedUserLogin: string | null = null;

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

function setLoadingState(nextIsLoading: boolean) {
  isLoading = nextIsLoading;
  button('btn-load').disabled = nextIsLoading;
  setButtonLabel(
    'btn-load',
    nextIsLoading ? 'fa-solid fa-circle-notch fa-spin' : 'fa-solid fa-arrow-right',
    'Load'
  );
  button('btn-clear').disabled = nextIsLoading;
  button('btn-toggle-token').disabled = nextIsLoading;
  button('toggle-all').disabled = nextIsLoading;
  input('token').readOnly = nextIsLoading;
  input('runs-limit').disabled = nextIsLoading;
  select('poll-interval').disabled = nextIsLoading;
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

function closeHelp(trigger: Element) {
  trigger.setAttribute('aria-expanded', 'false');
}

function closeAllHelp(exceptTrigger: Element | null = null) {
  document.querySelectorAll('[data-help-trigger][aria-expanded="true"]').forEach(trigger => {
    if (trigger !== exceptTrigger) closeHelp(trigger);
  });
}

function toggleHelp(trigger: Element) {
  const shouldOpen = trigger.getAttribute('aria-expanded') !== 'true';
  closeAllHelp(trigger);
  trigger.setAttribute('aria-expanded', String(shouldOpen));
}

function setTokenVisibility(isVisible: boolean) {
  const button = $('btn-toggle-token');
  input('token').type = isVisible ? 'text' : 'password';
  button.setAttribute('aria-label', isVisible ? 'Hide token' : 'Show token');
  button.setAttribute('aria-pressed', String(isVisible));
  button.title = isVisible ? 'Hide token' : 'Show token';
  button.replaceChildren(icon(isVisible ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye'));
}

function getRunsLimit() {
  const field = input('runs-limit');
  const normalizedValue = normalizeRunsLimit(field.value);

  field.value = String(normalizedValue);
  return normalizedValue;
}

function getPollIntervalMs() {
  return normalizePollIntervalMs(select('poll-interval').value);
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
    isPollingEnabled(select('poll-interval').value) &&
    !document.hidden
  );
}

function scheduleNextPoll() {
  clearPollTimer();
  if (!shouldSchedulePoll()) return;

  pollTimerId = setTimeout(() => {
    pollTimerId = null;
    void loadData(false, { showErrors: false });
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

async function validateToken(token: string) {
  const { login } = await api<{ login: string }>('/user', token);
  return login;
}

async function loadLiveRefs(fullName: string): Promise<LiveRefs | null> {
  try {
    const [branches, tags] = await Promise.all([
      paginate<GitRef>(`/repos/${fullName}/branches`),
      paginate<GitRef>(`/repos/${fullName}/tags`),
    ]);

    const branchShasByName = new Map<string, Set<string>>();
    const tagShasByName = new Map<string, Set<string>>();

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
  const repos = await paginate<Repository>('/user/repos?sort=full_name');

  const tasks = repos.map(repo => async () => {
    try {
      const { workflows = [] } = await api<{ workflows?: Workflow[] }>(
        `/repos/${repo.full_name}/actions/workflows`
      );
      if (!workflows.length) return null;

      const latestRuns: Record<string, WorkflowRun> = {};
      try {
        const liveRefsCache = new Map<string, Promise<LiveRefs | null>>();
        const getLiveRefs = (fullName: string) => {
          const refs = liveRefsCache.get(fullName) ?? loadLiveRefs(fullName);
          liveRefsCache.set(fullName, refs);
          return refs;
        };

        const workflowRuns = await paginate<WorkflowRun, { workflow_runs?: WorkflowRun[] }>(
          `/repos/${repo.full_name}/actions/runs`,
          data => data.workflow_runs ?? [],
          undefined,
          runsLimit
        );

        for (const run of workflowRuns) {
          const headRepoName = run.head_repository?.full_name;
          const headRepoFullName =
            headRepoName === '' ? repo.full_name : (headRepoName ?? repo.full_name);
          const liveRefs = await getLiveRefs(headRepoFullName);
          if (liveRefs && !liveRefs.names.has(run.head_branch)) continue;

          const refType = resolveRunRefType(run, liveRefs);
          const key = `${String(run.workflow_id)}:${headRepoFullName}:${refType}:${run.head_branch}`;
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

  return (await pool(tasks)).filter(result => result !== null);
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
    renderResults(results, authenticatedUserLogin);
    hasLoadedResults = true;
  } catch (e) {
    console.error(e);
    if (showErrors) {
      alert('Error: ' + (e instanceof Error ? e.message : String(e)));
    } else {
      setTokenStatus(e instanceof Error ? e.message : String(e), 'error');
    }
  } finally {
    setLoadingState(false);
    scheduleNextPoll();
  }
}

async function validateAndLoad() {
  if (isLoading) return;
  const val = input('token').value.trim();
  if (!val) {
    alert('Enter a GitHub token first.');
    return;
  }
  clearPollTimer();
  setLoadingState(true);

  try {
    authenticatedUserLogin = await validateToken(val);
    setToken(val);
    localStorage.setItem('github_token', val);
    setTokenStatus('Token was accepted by GitHub.');
    await loadData(true);
  } catch (e) {
    setTokenStatus(e instanceof Error ? e.message : String(e), 'error');
    setLoadingState(false);
  }
}

function toggleAll() {
  const repos = document.querySelectorAll('.repo');
  const allOpen = [...repos].every(r => r.classList.contains('open'));

  repos.forEach(r => {
    r.classList.toggle('open', !allOpen);
    r.querySelector('.repo-body')?.classList.toggle('hidden', allOpen);
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
  authenticatedUserLogin = null;
  input('token').value = '';
  setTokenVisibility(false);
  setTokenStatus();
  resetResultsView();
}

renderPollIntervalOptions();

$('btn-load').addEventListener('click', () => {
  void validateAndLoad();
});
$('btn-clear').addEventListener('click', handleClear);
$('btn-toggle-token').addEventListener('click', () => {
  setTokenVisibility(input('token').type === 'password');
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
  if (!(e.target instanceof Element) || !e.target.closest('.help-container')) closeAllHelp();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAllHelp();
});

$('token').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !isLoading) void validateAndLoad();
});

const savedToken = localStorage.getItem('github_token') ?? '';
if (savedToken) {
  setToken(savedToken);
  input('token').value = savedToken;
  setTokenStatus('Token is loaded from storage.');
}
